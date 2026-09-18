// app/api/customer/pay/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.customerSession.findFirst({
      where: { token, verified: true, expiresAt: { gte: new Date() } },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Missing orderId' }, { status: 400 });
    }

    const order = await prisma.voucherOrder.findFirst({
      where: { orderNumber: orderId },
      select: { orderNumber: true, status: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      orderId: order.orderNumber,
      status: order.status, // PENDING | PAID | FAILED
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    console.error('[Customer Pay Status] Error:', error);
    return NextResponse.json(
        { success: false, error: message },
        { status: 500 });
  }
}