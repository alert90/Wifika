import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { createAnyPayWalletPull } from '@/lib/payment/anypay';

export const dynamic = 'force-dynamic';

interface Body {
  agentId: string;
  amount: number;
  phone: string;
}

export async function POST(request: NextRequest) {
  try {
    const { agentId, amount, phone } = (await request.json()) as Body;

    if (!agentId || !amount || !phone) {
      return NextResponse.json(
        { success: false, error: 'Agent ID, amount and phone are required' },
        { status: 400 }
      );
    }

    if (amount < 100) {
      return NextResponse.json(
        { success: false, error: 'Minimum deposit is TZS 100' },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || !agent.isActive) {
      return NextResponse.json(
        { success: false, error: 'Agent not found or inactive' },
        { status: 403 }
      );
    }

    const gw = await prisma.paymentGateway.findFirst({
      where: { provider: 'anypay', isActive: true },
      select: { anypayApiKey: true },
    });
    if (!gw?.anypayApiKey) {
      return NextResponse.json(
        { success: false, error: 'AnyPay not configured' },
        { status: 500 }
      );
    }

    // Order number: AGT-PAY-YYYYMMDD-####
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const count = await prisma.agentPayment.count({
      where: { orderNumber: { startsWith: `AGT-PAY-${ymd}-` } },
    });
    const orderNumber = `AGT-PAY-${ymd}-${String(count + 1).padStart(4, '0')}`;

    const payment = await prisma.agentPayment.create({
      data: {
        id: crypto.randomUUID(),
        agentId: agent.id,
        orderNumber,
        amount: Math.round(amount),
        phone,
        status: 'PENDING',
      },
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      process.env.INTERNAL_API_URL;
    if (!appUrl) {
      return NextResponse.json(
        { success: false, error: 'App URL not configured' },
        { status: 500 }
      );
    }
    const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/payment/anypay/webhook`;

    const pull = await createAnyPayWalletPull(gw.anypayApiKey, {
      orderId: orderNumber,
      phone,
      amount: Math.round(amount),
      webhookUrl,
      webhookVersion: 2,
    });

    await prisma.agentPayment.update({
      where: { id: payment.id },
      data: { transactionId: pull.transId || pull.paymentReference || null },
    });

    return NextResponse.json({
      success: true,
      orderNumber,
      transactionId: pull.transId,
      message: pull.message || 'STK sent. Enter PIN on your phone.',
    });
  } catch (error) {
    console.error('[Agent Deposit] Error:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}