// app/api/customer/pay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[Customer Pay] === REQUEST START ===');

    // Authenticate
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.customerSession.findFirst({
      where: { token, verified: true, expiresAt: { gte: new Date() } },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
    }

    // Parse body
    const { profileId, phone, amount } = await request.json();
    if (!profileId || !phone || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate profile
    const profile = await prisma.hotspotProfile.findUnique({ where: { id: profileId } });
    if (!profile || !profile.isActive) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive profile' },
        { status: 404 }
      );
    }

    // Get customer info
    let customerName = 'Customer';
    let customerPhone = phone;
    if (!session.userId.startsWith('voucher_')) {
      const user = await prisma.pppoeUser.findUnique({
        where: { id: session.userId },
        select: { name: true, phone: true },
      });
      if (user) {
        customerName = user.name;
        customerPhone = user.phone || phone;
      }
    } else {
      const voucher = await prisma.hotspotVoucher.findUnique({
        where: { id: session.userId.replace('voucher_', '') },
        select: { lastUsedBy: true },
      });
      if (voucher?.lastUsedBy) customerName = voucher.lastUsedBy;
    }

    // Generate order number
    const now = new Date();
    const dateStr =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const count = await prisma.voucherOrder.count({
      where: { orderNumber: { startsWith: `EVC-${dateStr}-` } },
    });
    const orderNumber = `EVC-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    // Create order
    const order = await prisma.voucherOrder.create({
      data: {
        id: crypto.randomUUID(),
        orderNumber,
        profileId: profile.id,
        quantity: 1,
        customerName,
        customerPhone,
        totalAmount: amount,
        status: 'PENDING',
      },
    });

    console.log('[Customer Pay] Order created:', orderNumber);

    // !!! CRITICAL FIX: Use localhost for internal API calls, NOT public domain !!!
    const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
    const paymentUrl = `${baseUrl}/api/payment/create`;
    console.log('[Customer Pay] Calling internal payment/create at:', paymentUrl);

    const paymentRes = await fetch(paymentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: order.orderNumber,
        amount,
        gateway: 'anypay',
        type: 'voucher',
      }),
    });

    // Read response
    const responseText = await paymentRes.text();
    console.log('[Customer Pay] Response status:', paymentRes.status);
    console.log('[Customer Pay] Response body (first 500 chars):', responseText.substring(0, 500));

    if (!paymentRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment creation failed (${paymentRes.status}): ${responseText.substring(0, 200)}`,
        },
        { status: 500 }
      );
    }

    let paymentData;
    try {
      paymentData = JSON.parse(responseText);
    } catch (e) {
      console.error('[Customer Pay] Invalid JSON:', e);
      return NextResponse.json(
        { success: false, error: 'Invalid response from payment service' },
        { status: 500 }
      );
    }

    // Update order
    await prisma.voucherOrder.update({
      where: { id: order.id },
      data: {
        paymentLink: paymentData.paymentUrl,
        paymentToken: paymentData.gatewayOrderId,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.orderNumber,
      paymentUrl: paymentData.paymentUrl,
    });
  } catch (error: any) {
    console.error('[Customer Pay] FATAL ERROR:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}