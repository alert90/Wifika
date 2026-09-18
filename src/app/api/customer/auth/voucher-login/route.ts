// src/app/api/customer/auth/voucher-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { voucherCode } = await request.json();

    if (!voucherCode) {
      return NextResponse.json(
        { success: false, error: 'Voucher code is required' },
        { status: 400 }
      );
    }

    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code: String(voucherCode).toUpperCase() },
      include: {
        profile: {
          select: {
            name: true,
            speed: true,
            sellingPrice: true,
            validityValue: true,
            validityUnit: true,
            sharedUsers: true,
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

    const userId = `voucher_${voucher.id}`;

    // ✅ ONE SESSION AT A TIME — clear prior sessions for this voucher
    await prisma.customerSession.deleteMany({
      where: { userId },
    });

    const token = nanoid(64);
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.customerSession.create({
      data: {
        userId,
        phone: voucher.lastUsedBy || '0000000000',
        token,
        expiresAt: sessionExpiresAt,
        verified: true,
      },
    });

    // Set first login / expiry
    let expiresAt = voucher.expiresAt;
    if (!expiresAt && voucher.profile) {
      const validityMs =
        voucher.profile.validityUnit === 'MINUTES'
          ? voucher.profile.validityValue * 60 * 1000
          : voucher.profile.validityUnit === 'HOURS'
          ? voucher.profile.validityValue * 60 * 60 * 1000
          : voucher.profile.validityUnit === 'DAYS'
          ? voucher.profile.validityValue * 24 * 60 * 60 * 1000
          : voucher.profile.validityValue * 30 * 24 * 60 * 60 * 1000;
      expiresAt = new Date(now.getTime() + validityMs);
    }

    const updated = await prisma.hotspotVoucher.update({
      where: { id: voucher.id },
      data: {
        status: voucher.status === 'WAITING' ? 'ACTIVE' : voucher.status,
        firstLoginAt: voucher.firstLoginAt || now,
        expiresAt: expiresAt || undefined,
      },
    });

    const remainingMs = expiresAt ? expiresAt.getTime() - now.getTime() : 0;

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: userId,
        username: voucher.code,
        name: voucher.lastUsedBy || 'Voucher User',
        phone: 'N/A',
        email: null,
        status: updated.status === 'EXPIRED' ? 'expired' : 'active',
        expiredAt: expiresAt,
        profile: voucher.profile
          ? {
              name: voucher.profile.name,
              speed: voucher.profile.speed,
              downloadSpeed: parseInt(voucher.profile.speed.split('/')[0] || '0'),
              uploadSpeed: parseInt(voucher.profile.speed.split('/')[1] || '0'),
            }
          : null,
        voucherInfo: {
          code: voucher.code,
          profileName: voucher.profile?.name,
          speed: voucher.profile?.speed,
          status: updated.status,
          price: voucher.profile?.sellingPrice,
          timeRemainingMs: remainingMs > 0 ? remainingMs : 0,
        },
      },
    });
  } catch (error) {
    console.error('Voucher login error:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}