// app/api/customer/pay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { createAnyPayWalletPull } from '@/lib/payment/anypay';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[Customer Pay] === REQUEST START ===');

    // 1) Authenticate
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

    // 2) Parse + validate body
    const { profileId, phone, amount } = await request.json();
    if (!profileId || !phone || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const profile = await prisma.hotspotProfile.findUnique({ where: { id: profileId } });
    if (!profile || !profile.isActive) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive profile' },
        { status: 404 }
      );
    }

    // 3) Customer name resolution
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

    // 4) Generate order number
    const now = new Date();
    const dateStr =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const count = await prisma.voucherOrder.count({
      where: { orderNumber: { startsWith: `EVC-${dateStr}-` } },
    });
    const orderNumber = `EVC-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    // 5) Create local order (PENDING)
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

    // 6) Load AnyPay config
    const gateway = await prisma.paymentGateway.findFirst({
      where: { provider: 'anypay', isActive: true },
      select: { anypayApiKey: true },
    });
    if (!gateway?.anypayApiKey) {
      return NextResponse.json(
        { success: false, error: 'AnyPay is not configured or inactive' },
        { status: 500 }
      );
    }

    // 7) Build absolute webhook URL (must be publicly reachable)
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      process.env.INTERNAL_API_URL;
    if (!appUrl) {
      return NextResponse.json(
        { success: false, error: 'App URL is not configured (NEXT_PUBLIC_APP_URL missing)' },
        { status: 500 }
      );
    }
    const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/payment/anypay/webhook`;

    // 8) Kick off wallet pull (STK push)
    const pull = await createAnyPayWalletPull(gateway.anypayApiKey, {
      orderId: order.orderNumber,
      phone,
      amount,
      webhookUrl,
      webhookVersion: 2,
    });

    // 9) Store AnyPay reference on the order
    await prisma.voucherOrder.update({
      where: { id: order.id },
      data: {
        paymentToken: pull.transId || pull.paymentReference || order.orderNumber,
      },
    });

    // 10) Return — frontend should now poll status, NOT redirect
    return NextResponse.json({
      success: true,
      orderId: order.orderNumber,
      transactionId: pull.transId,
      paymentReference: pull.paymentReference,
      message:
        pull.message ||
        'Payment request sent. Please check your phone and enter your mobile money PIN to confirm.',
    });
  } catch (error: unknown) {
    const message =
       error instanceof Error ? error.message : 'Internal server error';
    console.error('[Customer Pay] FATAL ERROR:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}