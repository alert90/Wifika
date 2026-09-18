// app/api/payment/anypay/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface AnyPayWebhookPayload {
  msisdn?: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
  orderReference?: string;
  order_id?: string;
  status?: string;
  processedAt?: string;
  remarks?: string;
  transid?: string;
  [key: string]: unknown;
}

interface AnyPayWebhookBody {
  status?: string;
  code?: string;
  description?: string;
  provider?: string;
  payload?: AnyPayWebhookPayload;
  // V1 flat fields
  order_id?: string;
  transid?: string;
  amount?: number;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function isSuccessfulStatus(status: string): boolean {
  return ['completed', 'success', 'successful', 'paid'].includes(
    status.toLowerCase()
  );
}

/* ------------------------------------------------------------------ */
/* POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await request.text();
    console.log('[AnyPay Webhook] Raw:', rawBody);

    const body = JSON.parse(rawBody) as AnyPayWebhookBody;
    const payload: AnyPayWebhookPayload = body.payload ?? body;

    const orderReference: string | undefined =
      payload.orderReference || payload.order_id || body.order_id;

    const transactionId: string | undefined =
      payload.transactionId || payload.transid || body.transid;

    // NOTE: captured for logging only (was previously flagged unused).
    const msisdn: string | undefined = payload.msisdn;

    const amount = Number(payload.amount ?? body.amount ?? 0);
    const status = String(payload.status ?? body.status ?? '').toLowerCase();
    const description =
      body.description || payload.remarks || payload.status || 'unknown';

    const isSuccess = isSuccessfulStatus(status);

        // 1) Always log the incoming webhook
        try {
            await prisma.webhookLog.create({
              data: {
                id: crypto.randomUUID(),
                gateway: 'anypay',
                orderId: orderReference || 'unknown',
                status: isSuccess ? 'SUCCESS' : 'CANCELLED',
                transactionId: transactionId ?? null,
                amount: amount || null,
                success: isSuccess,
                errorMessage: isSuccess ? null : String(description),
                payload: JSON.stringify({
                  raw: body,
                  msisdn: msisdn ?? null,
                }),
                response: JSON.stringify({
                  received: true,
                  processedAt: new Date().toISOString(),
                }),
              },
            });
          } catch (logErr) {
            console.error('[AnyPay Webhook] Failed to persist log:', logErr);
          }

    if (!orderReference) {
      return NextResponse.json({
        status: 'success',
        message: 'No order reference',
      });
    }

    // 2) Lookup order
    const order = await prisma.voucherOrder.findFirst({
      where: { orderNumber: orderReference },
    });

    if (!order) {
      console.warn('[AnyPay Webhook] Unknown order:', orderReference);
      return NextResponse.json({
        status: 'success',
        message: 'Order not found',
      });
    }

    // 3) Idempotency
    if (order.status === 'PAID' || order.status === 'CANCELLED') {
      return NextResponse.json({
        status: 'success',
        message: 'Already processed',
      });
    }

    // 4) Apply outcome
    if (isSuccess) {
      await prisma.voucherOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentToken: transactionId || order.paymentToken,
        },
      });

      // 🔔 TODO: activate the customer's voucher / hotspot access here.
      console.log('[AnyPay Webhook] ✅ Order PAID:', orderReference);
    } else {
      await prisma.voucherOrder.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
      console.log(
        '[AnyPay Webhook] ❌ Order CANCELLED:',
        orderReference,
        description
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Webhook processed',
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown webhook error';
    console.error('[AnyPay Webhook] Error:', error, 'raw:', rawBody);
    return NextResponse.json({ status: 'error', message });
  }
}

/* Setup ping */
export async function GET() {
  return NextResponse.json({ status: 'ok', gateway: 'anypay' });
}