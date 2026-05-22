import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '255' + cleanPhone.substring(1); // Tanzania country code
    }
    if (!cleanPhone.startsWith('255')) {
      cleanPhone = '255' + cleanPhone;
    }

    // Find user by phone
    const user = await prisma.pppoeUser.findFirst({
      where: {
        OR: [
          { phone: phone },
          { phone: cleanPhone },
          { phone: '0' + cleanPhone.substring(3) }, // 0xxx format
          { phone: cleanPhone.substring(3) }, // Without country code
        ],
      },
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
        { success: false, error: 'Phone number not registered' },
        { status: 404 }
      );
    }

    // Create session directly without OTP
    const token = nanoid(64);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.customerSession.create({
      data: {
        userId: user.id,
        phone: cleanPhone,
        token,
        expiresAt,
        verified: true,
        otpCode: null,
        otpExpiry: null,
      },
    });

    return NextResponse.json({
      success: true,
      requireOTP: false,
      user,
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}