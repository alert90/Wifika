import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber');
    if (!orderNumber) {
      return NextResponse.json({ success: false, error: 'orderNumber required' }, { status: 400 });
    }

    const payment = await prisma.agentPayment.findUnique({
      where: { orderNumber },
      select: { orderNumber: true, status: true, amount: true, paidAt: true },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}