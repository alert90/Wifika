// src/app/api/customer/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // ---------------- Voucher user ----------------
    if (session.userId.startsWith('voucher_')) {
      const voucherId = session.userId.replace('voucher_', '');
      const voucher = await prisma.hotspotVoucher.findUnique({
        where: { id: voucherId },
        include: {
          profile: {
            select: {
              name: true,
              speed: true,
              sellingPrice: true,
              costPrice: true,
              validityValue: true,
              validityUnit: true,
              sharedUsers: true,
            },
          },
        },
      });

      if (!voucher) {
        return NextResponse.json(
          { success: false, error: 'Voucher not found' },
          { status: 404 }
        );
      }

      // Calculate expiresAt on the fly if missing but voucher is active
      let expiresAt = voucher.expiresAt;
      if (!expiresAt && voucher.status === 'ACTIVE' && voucher.firstLoginAt) {
        const firstLogin = new Date(voucher.firstLoginAt);
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
              validityMs = 24 * 60 * 60 * 1000;
          }
        }

        expiresAt = new Date(firstLogin.getTime() + validityMs);

        await prisma.hotspotVoucher.update({
          where: { id: voucher.id },
          data: { expiresAt },
        });
      }

      // Time remaining
      let timeRemainingMs = 0;
      let timeRemainingText = '';
      let isExpired = false;

      const now = new Date();
      if (expiresAt) {
        timeRemainingMs = expiresAt.getTime() - now.getTime();
        isExpired = timeRemainingMs <= 0;

        if (timeRemainingMs > 0) {
          const totalSeconds = Math.floor(timeRemainingMs / 1000);
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;

          if (days > 0) {
            timeRemainingText = `${days}d ${hours}h ${minutes}m`;
          } else if (hours > 0) {
            timeRemainingText = `${hours}h ${minutes}m ${seconds}s`;
          } else if (minutes > 0) {
            timeRemainingText = `${minutes}m ${seconds}s`;
          } else {
            timeRemainingText = `${seconds}s`;
          }
        } else {
          timeRemainingText = 'Expired';
        }
      } else if (voucher.profile) {
        timeRemainingText = `${voucher.profile.validityValue} ${voucher.profile.validityUnit.toLowerCase()}`;
        timeRemainingMs = 0;
      }

      const validityDisplay = voucher.profile
        ? `${voucher.profile.validityValue} ${voucher.profile.validityUnit.toLowerCase()}`
        : 'N/A';

      const user = {
        id: `voucher_${voucher.id}`,
        username: voucher.code,
        name: voucher.lastUsedBy || 'Voucher User',
        phone: session.phone || 'N/A',
        email: null,
        status: voucher.status === 'EXPIRED' ? 'expired' : 'active',
        expiredAt: expiresAt,
        profile: {
          name: voucher.profile?.name || 'Voucher Package',
          downloadSpeed: parseInt(voucher.profile?.speed?.split('/')[0] || '100'),
          uploadSpeed: parseInt(voucher.profile?.speed?.split('/')[1] || '100'),
          speed: voucher.profile?.speed || '100/100',
          sellingPrice: voucher.profile?.sellingPrice || 0,
          validityValue: voucher.profile?.validityValue || 0,
          validityUnit: voucher.profile?.validityUnit || 'DAYS',
          sharedUsers: voucher.profile?.sharedUsers || 1,
        },
        voucherInfo: {
          code: voucher.code,
          profileName: voucher.profile?.name,
          speed: voucher.profile?.speed,
          status: voucher.status,
          validityDisplay,
          timeRemainingMs,
          timeRemainingText,
          isExpired,
          price: voucher.profile?.sellingPrice,
        },
      };

      return NextResponse.json({ success: true, user });
    }

    // ---------------- Hotspot user (phone-based) ----------------
    if (session.userId.startsWith('hotspot_')) {
      const hotspotId = session.userId.replace('hotspot_', '');
      const user = await prisma.hotspotUser.findUnique({
        where: { id: hotspotId },
        include: { profile: true },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: session.userId,
          name: user.name,
          phone: user.phone,
          username: user.phone,
          status: user.status,
          expiredAt: user.expiredAt,
          profile: user.profile
            ? {
                name: user.profile.name,
                speed: user.profile.speed,
                downloadSpeed: parseInt(user.profile.speed.split('/')[0] || '0'),
                uploadSpeed: parseInt(user.profile.speed.split('/')[1] || '0'),
              }
            : null,
        },
      });
    }

    // ---------------- Regular PPPoE user ----------------
    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        expiredAt: true,
        profile: {
          select: {
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Get customer data error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}