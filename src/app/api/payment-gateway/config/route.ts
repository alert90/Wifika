import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const configs = await prisma.paymentGateway.findMany({
      select: {
        id: true,
        provider: true,
        name: true,
        isActive: true,
        midtransClientKey: true,
        midtransServerKey: true,
        midtransEnvironment: true,
        xenditApiKey: true,
        xenditWebhookToken: true,
        xenditEnvironment: true,
        duitkuMerchantCode: true,
        duitkuApiKey: true,
        duitkuEnvironment: true,
        mpesaConsumerKey: true,
        mpesaConsumerSecret: true,
        mpesaPasskey: true,
        mpesaShortcode: true,
        mpesaEnvironment: true,
        selcomApiKey: true,
        selcomSecretKey: true,
        selcomVendorName: true,
        selcomEnvironment: true,
        pesapalMerchantId: true,
        pesapalApiKey: true,
        pesapalSecretKey: true,
        pesapalEnvironment: true,
        anypayApiKey: true,
        anypayEnvironment: true, 
      },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error('Get payment gateway configs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment gateway configs' },
      { status: 500 }
    );
  }
}

// POST handler already includes anypayApiKey/anypayEnvironment in data