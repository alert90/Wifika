// src/app/api/payment/create/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAnyPayOrder } from '@/lib/payment/anypay';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface AnyPayResult {
  order_id?: string;
  reference?: string;
  payment_url?: string;
  payment_reference?: string;
  transid?: string;
  [key: string]: unknown;
}

interface CreatePaymentBody {
  invoiceId?: string;
  orderNumber?: string;
  amount?: number;
  gateway?: string;
  type?: 'voucher' | 'invoice';
}

export async function POST(request: Request) {
  console.log('[Payment Create] === REQUEST RECEIVED ===');
  try {
    const body = (await request.json()) as CreatePaymentBody;
    console.log('[Payment Create] Body:', JSON.stringify(body, null, 2));

    const { invoiceId, orderNumber, amount, gateway, type } = body;

    // VOUCHER
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

      return await createVoucherPayment(
        {
          id: order.id,
          orderNumber: order.orderNumber,
          customerPhone: order.customerPhone,
          totalAmount: order.totalAmount,
        },
        gateway
      );
    }

    // INVOICE
    if (!invoiceId || !gateway) {
      return NextResponse.json(
        { error: 'Invoice ID and gateway are required' },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { user: { include: { profile: true } } },
    });

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status === 'PAID') return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });

    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: gateway },
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json({ error: 'Payment gateway not available' }, { status: 400 });
    }

    const customerPhone = invoice.user?.phone || invoice.customerPhone || '';
    const fallbackOrderId = `INV-${invoice.invoiceNumber}-${Date.now()}`;

    let paymentUrl = '';
    let transactionId = '';
    let gatewayOrderId = '';

    if (gateway === 'anypay') {
      if (!gatewayConfig.anypayApiKey) {
        return NextResponse.json({ error: 'AnyPay API key is not configured' }, { status: 400 });
      }

      try {
        console.log('[Payment Create] Calling AnyPay for invoice:', invoice.invoiceNumber);
        const result = (await createAnyPayOrder(
          gatewayConfig.anypayApiKey,
          customerPhone,
          invoice.amount
        )) as AnyPayResult;

        gatewayOrderId = String(result.order_id ?? '');
        transactionId = String(result.reference ?? result.order_id ?? fallbackOrderId);
        paymentUrl = String(result.payment_url ?? '');

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { paymentToken: gatewayOrderId },
        });

        console.log('[Payment Create] AnyPay success:', gatewayOrderId);
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
      return NextResponse.json({ error: 'Unsupported payment gateway' }, { status: 400 });
    }

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

    await prisma.webhookLog.create({
      data: {
        id: crypto.randomUUID(),
        gateway,
        orderId: gatewayOrderId,
        status: 'pending',
        transactionId: transactionId || null,
        amount: invoice.amount,
        payload: JSON.stringify({
          type: 'invoice',
          invoiceId: invoice.id,
          createdAt: new Date(),
        }),
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
    console.error('[Payment Create] FATAL:', error);
    return NextResponse.json(
      {
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

interface VoucherOrderLike {
  id: string;
  orderNumber: string;
  customerPhone: string;
  totalAmount: number;
}

async function createVoucherPayment(order: VoucherOrderLike, gateway: string) {
  console.log('[createVoucherPayment] Starting:', order.orderNumber);
  try {
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: gateway },
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json({ error: 'Payment gateway not available' }, { status: 400 });
    }

    const customerPhone = order.customerPhone || '';
    const fallbackOrderId = `EVC-${order.orderNumber}-${Date.now()}`;

    let paymentUrl = '';
    let gatewayOrderId = '';

    if (gateway === 'anypay') {
      if (!gatewayConfig.anypayApiKey) {
        return NextResponse.json({ error: 'AnyPay API key is not configured' }, { status: 400 });
      }

      try {
        console.log('[createVoucherPayment] Calling AnyPay for:', order.orderNumber);
        const result = (await createAnyPayOrder(
          gatewayConfig.anypayApiKey,
          customerPhone,
          order.totalAmount
        )) as AnyPayResult;

        paymentUrl = String(result.payment_url ?? '');
        gatewayOrderId = String(result.order_id ?? fallbackOrderId);
        console.log('[createVoucherPayment] AnyPay success:', gatewayOrderId);
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
      return NextResponse.json({ error: 'Unsupported payment gateway' }, { status: 400 });
    }

    await prisma.voucherOrder.update({
      where: { id: order.id },
      data: {
        paymentLink: paymentUrl,
        paymentToken: gatewayOrderId,
      },
    });

    await prisma.webhookLog.create({
      data: {
        id: crypto.randomUUID(),
        gateway,
        orderId: gatewayOrderId,
        status: 'pending',
        transactionId: null,
        amount: order.totalAmount,
        payload: JSON.stringify({
          type: 'voucher',
          orderId: order.id,
          orderNumber: order.orderNumber,
          createdAt: new Date(),
        }),
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
    console.error('[createVoucherPayment] FATAL:', error);
    return NextResponse.json(
      {
        error: 'Failed to create voucher payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}