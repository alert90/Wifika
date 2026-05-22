import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMpesaClient, formatPhoneNumberForMpesa } from '@/lib/payment/mpesa';
import { encryptToken } from '@/lib/payment/utils';

export const dynamic = 'force-dynamic';

/**
 * M-Pesa STK Push Payment API
 * POST /api/payment/mpesa
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, amount, customerPhone, customerName, customerEmail } = body;

    // Validate required fields
    if (!orderId || !amount || !customerPhone) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, amount, customerPhone' },
        { status: 400 }
      );
    }

    // Get M-Pesa configuration
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: 'mpesa' }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'M-Pesa is not configured or inactive' },
        { status: 400 }
      );
    }

    if (!gatewayConfig.mpesaConsumerKey || !gatewayConfig.mpesaConsumerSecret || 
        !gatewayConfig.mpesaPasskey || !gatewayConfig.mpesaShortcode) {
      return NextResponse.json(
        { error: 'M-Pesa configuration is incomplete' },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumberForMpesa(customerPhone);
    
    // Initialize M-Pesa client
    const mpesaClient = createMpesaClient({
      consumerKey: gatewayConfig.mpesaConsumerKey!,
      consumerSecret: gatewayConfig.mpesaConsumerSecret!,
      passkey: gatewayConfig.mpesaPasskey!,
      shortcode: gatewayConfig.mpesaShortcode!,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook`,
      environment: gatewayConfig.mpesaEnvironment as 'sandbox' | 'production'
    });

    // Create STK push request
    const stkResponse = await mpesaClient.initiateStkPush({
      phoneNumber: formattedPhone,
      amount: parseInt(amount),
      reference: orderId,
      description: `Payment for order ${orderId}`
    });

    if (stkResponse.ResponseCode !== '0') {
      return NextResponse.json(
        { 
          error: 'Failed to initiate M-Pesa payment',
          details: stkResponse.ResponseDescription 
        },
        { status: 400 }
      );
    }

    // Generate payment token for return URL
    const paymentToken = encryptToken({ invoiceId: orderId });

    return NextResponse.json({
      success: true,
      message: 'M-Pesa STK push initiated successfully',
      checkoutRequestID: stkResponse.CheckoutRequestID,
      merchantRequestID: stkResponse.MerchantRequestID,
      customerMessage: stkResponse.CustomerMessage,
      paymentToken,
      instructions: [
        'Please check your phone for the M-Pesa STK push prompt',
        'Enter your M-Pesa PIN to complete the payment',
        'You will receive a confirmation SMS once payment is complete'
      ]
    });

  } catch (error) {
    console.error('[M-Pesa] Payment initiation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initiate M-Pesa payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Check M-Pesa transaction status
 * GET /api/payment/mpesa?checkoutRequestID=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkoutRequestID = searchParams.get('checkoutRequestID');

    if (!checkoutRequestID) {
      return NextResponse.json(
        { error: 'checkoutRequestID is required' },
        { status: 400 }
      );
    }

    // Get M-Pesa configuration
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: 'mpesa' }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'M-Pesa is not configured or inactive' },
        { status: 400 }
      );
    }

    // Initialize M-Pesa client
    const mpesaClient = createMpesaClient({
      consumerKey: gatewayConfig.mpesaConsumerKey!,
      consumerSecret: gatewayConfig.mpesaConsumerSecret!,
      passkey: gatewayConfig.mpesaPasskey!,
      shortcode: gatewayConfig.mpesaShortcode!,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook`,
      environment: gatewayConfig.mpesaEnvironment as 'sandbox' | 'production'
    });

    // Check transaction status
    const statusResponse = await mpesaClient.checkTransactionStatus(checkoutRequestID);

    return NextResponse.json({
      success: true,
      data: statusResponse
    });

  } catch (error) {
    console.error('[M-Pesa] Status check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check M-Pesa transaction status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
