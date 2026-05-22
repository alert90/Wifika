import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPesapalClient, formatPhoneNumberForPesapal } from '@/lib/payment/pesapal';
import { encryptToken } from '@/lib/payment/utils';

export const dynamic = 'force-dynamic';

/**
 * Pesapal Payment API
 * POST /api/payment/pesapal
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

    // Get Pesapal configuration
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: 'pesapal' }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Pesapal is not configured or inactive' },
        { status: 400 }
      );
    }

    // Type assertion for new fields
    const config = gatewayConfig as any;

    if (!config.pesapalMerchantId || !config.pesapalApiKey || !config.pesapalSecretKey) {
      return NextResponse.json(
        { error: 'Pesapal configuration is incomplete' },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumberForPesapal(customerPhone);
    
    // Initialize Pesapal client
    const pesapalClient = createPesapalClient({
      merchantId: config.pesapalMerchantId!,
      apiKey: config.pesapalApiKey!,
      secretKey: config.pesapalSecretKey!,
      environment: config.pesapalEnvironment as 'sandbox' | 'production'
    });

    // Create payment request
    const paymentResponse = await pesapalClient.createPayment({
      orderId,
      amount: parseInt(amount),
      phoneNumber: formattedPhone,
      description: `Payment for order ${orderId}`,
      customerName: customerName || 'Customer',
      email: customerEmail || 'customer@example.com'
    });

    if (!paymentResponse.success) {
      return NextResponse.json(
        { 
          error: 'Failed to initiate Pesapal payment',
          details: paymentResponse.message 
        },
        { status: 400 }
      );
    }

    // Generate payment token for return URL
    const paymentToken = encryptToken({ invoiceId: orderId });

    return NextResponse.json({
      success: true,
      message: 'Pesapal payment initiated successfully',
      reference: paymentResponse.reference,
      paymentUrl: paymentResponse.paymentUrl,
      paymentToken,
      instructions: [
        'Please complete payment using the provided payment URL',
        'You can pay via mobile money, credit card, or banking channels',
        'You will receive a confirmation once payment is complete'
      ]
    });

  } catch (error) {
    console.error('[Pesapal] Payment initiation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initiate Pesapal payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Check Pesapal payment status
 * GET /api/payment/pesapal?orderId=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Get Pesapal configuration
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: 'pesapal' }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Pesapal is not configured or inactive' },
        { status: 400 }
      );
    }

    // Type assertion for new fields
    const config = gatewayConfig as any;

    // Initialize Pesapal client
    const pesapalClient = createPesapalClient({
      merchantId: config.pesapalMerchantId!,
      apiKey: config.pesapalApiKey!,
      secretKey: config.pesapalSecretKey!,
      environment: config.pesapalEnvironment as 'sandbox' | 'production'
    });

    // Check payment status
    const statusResponse = await pesapalClient.checkPaymentStatus(orderId);

    return NextResponse.json({
      success: true,
      data: statusResponse
    });

  } catch (error) {
    console.error('[Pesapal] Status check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check Pesapal payment status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Refund Pesapal payment
 * POST /api/payment/pesapal/refund
 */
export async function REFUND(request: Request) {
  try {
    const body = await request.json();
    const { orderId, amount } = body;

    // Validate required fields
    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing required field: orderId' },
        { status: 400 }
      );
    }

    // Get Pesapal configuration
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: 'pesapal' }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Pesapal is not configured or inactive' },
        { status: 400 }
      );
    }

    // Type assertion for new fields
    const config = gatewayConfig as any;

    // Initialize Pesapal client
    const pesapalClient = createPesapalClient({
      merchantId: config.pesapalMerchantId!,
      apiKey: config.pesapalApiKey!,
      secretKey: config.pesapalSecretKey!,
      environment: config.pesapalEnvironment as 'sandbox' | 'production'
    });

    // Process refund
    const refundResponse = await pesapalClient.refundPayment(orderId, amount ? parseInt(amount) : undefined);

    return NextResponse.json({
      success: true,
      message: 'Refund processed successfully',
      data: refundResponse
    });

  } catch (error) {
    console.error('[Pesapal] Refund error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process Pesapal refund',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
