import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const { voucherCode, customerName, customerPhone } = await request.json();

    if (!voucherCode) {
      return NextResponse.json(
        { success: false, error: 'Voucher code is required' },
        { status: 400 }
      );
    }

    // Find voucher by code
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code: voucherCode.toUpperCase() },
      include: {
        profile: {
          select: {
            name: true,
            sellingPrice: true,
            validityValue: true,
            validityUnit: true,
            speed: true,
          },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json(
        { success: false, error: 'Invalid voucher code' },
        { status: 404 }
      );
    }

    // Check if voucher is expired
    const now = new Date();
    if (voucher.expiresAt && now > voucher.expiresAt) {
      await prisma.hotspotVoucher.update({
        where: { id: voucher.id },
        data: { status: 'EXPIRED' },
      });
      
      return NextResponse.json(
        { success: false, error: 'Voucher has expired' },
        { status: 400 }
      );
    }

    // Check if already used (only if status is ACTIVE and has a real user)
    if (voucher.status === 'ACTIVE' && voucher.lastUsedBy) {
      const existingSession = await prisma.customerSession.findFirst({
        where: {
          userId: `voucher_${voucher.id}`,
          verified: true,
          expiresAt: { gte: new Date() }
        }
      });


      if (!existingSession && voucher.lastUsedBy !== 'Anonymous' && voucher.lastUsedBy !== 'Voucher User') {
        return NextResponse.json(
          { success: false, error: 'Voucher has already been used' },
          { status: 400 }
        );
      }
      
    }

    // Create customer session
    const token = nanoid(64);
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.customerSession.create({
      data: {
        userId: `voucher_${voucher.id}`,
        phone: customerPhone || '0000000000',
        token,
        expiresAt: sessionExpiresAt,
        verified: true,
        otpCode: null,
        otpExpiry: null,
      },
    });

    // Calculate expiry time for the voucher based on profile validity
    let expiresAt = voucher.expiresAt;
    if (!expiresAt) {
      // Calculate expiry based on profile validity
      const now = new Date();
      let validityMs = 0;
      
      if (voucher.profile) {
        switch (voucher.profile.validityUnit) {
          case 'MINUTES':
            validityMs = voucher.profile.validityValue * 60 * 1000;
            break;
          case 'HOURS':
            validityMs = voucher.profile.validityValue * 60 * 60 * 1000;
            break;
          case 'DAYS':
            validityMs = voucher.profile.validityValue * 24 * 60 * 60 * 1000;
            break;
          default:
            validityMs = 24 * 60 * 60 * 1000; // Default 24 hours
        }
      } else {
        validityMs = 24 * 60 * 60 * 1000; // Default 24 hours
      }
      
      expiresAt = new Date(now.getTime() + validityMs);
    }

    // Update voucher status to ACTIVE if it's WAITING, and set expiresAt
    const updatedVoucher = await prisma.hotspotVoucher.update({
      where: { id: voucher.id },
      data: {
        status: voucher.status === 'WAITING' ? 'ACTIVE' : voucher.status,
        firstLoginAt: voucher.firstLoginAt || now,
        expiresAt: expiresAt, // ✅ IMPORTANT: Set the expiry date!
        lastUsedBy: customerName || 'Voucher User',
      },
    });

    // Calculate time remaining text
    let timeRemainingText = '';
    const remainingMs = expiresAt.getTime() - now.getTime();
    if (remainingMs > 0) {
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      if (days > 0) {
        timeRemainingText = `${days} days ${hours % 24} hours`;
      } else if (hours > 0) {
        timeRemainingText = `${hours} hours`;
      } else {
        const minutes = Math.floor(remainingMs / (1000 * 60));
        timeRemainingText = `${minutes} minutes`;
      }
    } else {
      timeRemainingText = 'Expired';
    }

    // Prepare user data for response
    const user = {
      id: `voucher_${voucher.id}`,
      username: voucher.code,
      name: customerName || 'Voucher User',
      phone: customerPhone || 'N/A',
      email: null,
      status: 'active',
      expiredAt: expiresAt, // ✅ Now this has a real date
      profile: voucher.profile,
      voucherInfo: {
        code: voucher.code,
        profileName: voucher.profile?.name || 'Unknown',
        validityValue: voucher.profile?.validityValue || 0,
        validityUnit: voucher.profile?.validityUnit || 'DAYS',
        speed: voucher.profile?.speed || 'N/A',
        timeRemainingText: timeRemainingText,
        status: updatedVoucher.status,
        price: voucher.profile?.sellingPrice || 0,
        timeRemainingMs: remainingMs,
        isExpired: remainingMs <= 0,
        validityDisplay: voucher.profile 
          ? `${voucher.profile.validityValue} ${voucher.profile.validityUnit.toLowerCase()}`
          : 'N/A',
      },
    };
    return NextResponse.json({
      success: true,
      requireOTP: false,
      user,
      token,
    });
  } catch (error: unknown) {
    console.error('Voucher login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}