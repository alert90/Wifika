// app/api/payment/create/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAnyPayOrder } from '@/lib/payment/anypay';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  console.log('[Payment Create] === REQUEST RECEIVED ===');
  try {
    const body = await request.json();
    console.log('[Payment Create] Body:', JSON.stringify(body, null, 2));

    const { invoiceId, orderNumber, amount, gateway, type } = body;

    // ========== VOUCHER ORDERS ==========
    if (type === 'voucher') {
      if (!orderNumber || !amount || !gateway) {
        return NextResponse.json(
          { error: 'Order number, amount and gateway are required for voucher orders' },
          { status: 400 }
        );
      }

      const order = await prisma.voucherOrder.findFirst({
        where: { orderNumber },
        include: { profile: true },
      });

      if (!order) {
        return NextResponse.json({ error: 'Voucher order not found' }, { status: 404 });
      }

      if (order.status === 'PAID') {
        return NextResponse.json({ error: 'Order already paid' }, { status: 400 });
      }

      return await createVoucherPayment(order, gateway);
    }

    // ========== INVOICE PAYMENTS ==========
    if (!invoiceId || !gateway) {
      return NextResponse.json(
        { error: 'Invoice ID and gateway are required' },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: { include: { profile: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });
    }

    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: gateway },
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Payment gateway not available' },
        { status: 400 }
      );
    }

    const customerPhone = invoice.user?.phone || invoice.customerPhone || '';
    const orderId = `INV-${invoice.invoiceNumber}-${Date.now()}`;

    let paymentUrl = '';
    let transactionId = '';
    let gatewayOrderId = '';

    if (gateway === 'anypay') {
      if (!gatewayConfig.anypayApiKey) {
        return NextResponse.json(
          { error: 'AnyPay API key is not configured' },
          { status: 400 }
        );
      }

      try {
        console.log('[Payment Create] Calling AnyPay for invoice:', invoice.invoiceNumber);
        const result = await createAnyPayOrder(
          gatewayConfig.anypayApiKey,
          customerPhone,
          invoice.amount
        );

        gatewayOrderId = result.order_id;
        transactionId = result.reference || result.order_id || orderId;
        paymentUrl = result.payment_url;

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { paymentToken: gatewayOrderId },
        });

        console.log('[Payment Create] AnyPay success, gatewayOrderId:', gatewayOrderId);
      } catch (error) {
        console.error('[Payment Create] AnyPay error:', error);
        return NextResponse.json(
          {
            error: 'Failed to create AnyPay payment',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported payment gateway' },
        { status: 400 }
      );
    }

    // Save payment record
    const payment = await prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        amount: invoice.amount,
        method: `${gateway}_invoice`,
        gatewayId: gatewayConfig.id,
        status: 'pending',
      },
    });

    // Webhook log
    await prisma.webhookLog.create({
      data: {
        id: crypto.randomUUID(),
        gateway,
        orderId: gatewayOrderId,
        status: 'pending',
        transactionId: transactionId || null,
        amount: invoice.amount,
        payload: JSON.stringify({ type: 'invoice', invoiceId: invoice.id, createdAt: new Date() }),
        response: JSON.stringify({ paymentUrl }),
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      payment,
      orderId: gatewayOrderId,
      paymentUrl,
      gatewayOrderId,
    });
  } catch (error) {
    console.error('[Payment Create] FATAL ERROR:', error);
    return NextResponse.json(
      {
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ========== HELPER: VOUCHER PAYMENT ==========
async function createVoucherPayment(order: any, gateway: string) {
  console.log('[createVoucherPayment] Starting for order:', order.orderNumber);
  try {
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: gateway },
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Payment gateway not available' },
        { status: 400 }
      );
    }

    const customerPhone = order.customerPhone || '';
    const orderId = `EVC-${order.orderNumber}-${Date.now()}`;

    let paymentUrl = '';
    let gatewayOrderId = '';

    if (gateway === 'anypay') {
      if (!gatewayConfig.anypayApiKey) {
        return NextResponse.json(
          { error: 'AnyPay API key is not configured' },
          { status: 400 }
        );
      }

      try {
        console.log('[createVoucherPayment] Calling AnyPay for voucher:', order.orderNumber);
        const result = await createAnyPayOrder(
          gatewayConfig.anypayApiKey,
          customerPhone,
          order.totalAmount
        );

        paymentUrl = result.payment_url;
        gatewayOrderId = result.order_id;
        console.log('[createVoucherPayment] AnyPay success, gatewayOrderId:', gatewayOrderId);
      } catch (error) {
        console.error('[createVoucherPayment] AnyPay error:', error);
        return NextResponse.json(
          {
            error: 'Failed to create AnyPay payment',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported payment gateway' },
        { status: 400 }
      );
    }

    // Update order
    await prisma.voucherOrder.update({
      where: { id: order.id },
      data: {
        paymentLink: paymentUrl,
        paymentToken: gatewayOrderId,
      },
    });

    // Webhook log
    await prisma.webhookLog.create({
      data: {
        id: crypto.randomUUID(),
        gateway,
        orderId: gatewayOrderId,
        status: 'pending',
        transactionId: null,
        amount: order.totalAmount,
        payload: JSON.stringify({ type: 'voucher', orderId: order.id, orderNumber: order.orderNumber, createdAt: new Date() }),
        response: JSON.stringify({ paymentUrl }),
        success: true,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.orderNumber,
      paymentUrl,
      gatewayOrderId,
    });
  } catch (error) {
    console.error('[createVoucherPayment] FATAL ERROR:', error);
    return NextResponse.json(
      {
        error: 'Failed to create voucher payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}