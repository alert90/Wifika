// src/app/api/customer/auth/hotspot-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone required' },
        { status: 400 }
      );
    }

    // Normalize to 07XXXXXXXX
    let cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.startsWith('255')) {
      cleanPhone = '0' + cleanPhone.substring(3);
    }
    if (!cleanPhone.startsWith('0')) {
      cleanPhone = '0' + cleanPhone;
    }

    // Look up or create
    let user = await prisma.hotspotUser.findUnique({
      where: { phone: cleanPhone },
      include: { profile: true },
    });

    if (!user) {
      user = await prisma.hotspotUser.create({
        data: {
          id: crypto.randomUUID(),
          name: 'Guest',
          phone: cleanPhone,
          status: 'active',
        },
        include: { profile: true },
      });
      console.log(`[Hotspot Login] Auto-created user for ${cleanPhone}`);
    }

    if (user.status === 'blocked') {
      return NextResponse.json(
        { success: false, error: 'Account blocked. Contact support.' },
        { status: 403 }
      );
    }

    // ✅ ONE SESSION AT A TIME — clear any prior sessions for this user
    const deleted = await prisma.customerSession.deleteMany({
      where: { userId: `hotspot_${user.id}` },
    });
    if (deleted.count > 0) {
      console.log(
        `[Hotspot Login] Cleared ${deleted.count} prior session(s) for ${cleanPhone}`
      );
    }

    // Also clear any session that had this phone but a different userId
    await prisma.customerSession.deleteMany({
      where: { phone: cleanPhone },
    });

    const token = nanoid(64);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.customerSession.create({
      data: {
        userId: `hotspot_${user.id}`,
        phone: user.phone,
        token,
        expiresAt,
        verified: true,
      },
    });

    await prisma.hotspotUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: `hotspot_${user.id}`,
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
              validityValue: user.profile.validityValue,
              validityUnit: user.profile.validityUnit,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Hotspot login error:', error);
    const msg = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}