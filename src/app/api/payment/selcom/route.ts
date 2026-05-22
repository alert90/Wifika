import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSelcomClient, formatPhoneNumberForSelcom } from '@/lib/payment/selcom';
import { encryptToken } from '@/lib/payment/utils';

export const dynamic = 'force-dynamic';

/**
 * Selcom Payment API
 * POST /api/payment/selcom
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

    // Get Selcom configuration
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: 'selcom' }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Selcom is not configured or inactive' },
        { status: 400 }
      );
    }

    // Type assertion for new fields
    const config = gatewayConfig as any;

    if (!config.selcomApiKey || !config.selcomSecretKey || !config.selcomVendorName) {
      return NextResponse.json(
        { error: 'Selcom configuration is incomplete' },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumberForSelcom(customerPhone);
    
    // Initialize Selcom client
    const selcomClient = createSelcomClient({
      apiKey: config.selcomApiKey!,
      secretKey: config.selcomSecretKey!,
      vendorName: config.selcomVendorName!,
      environment: config.selcomEnvironment as 'sandbox' | 'production'
    });

    // Create payment request
    const paymentResponse = await selcomClient.createPayment({
      orderId,
      amount: parseInt(amount),
      phoneNumber: formattedPhone,
      description: `Payment for order ${orderId}`,
      customerName: customerName || 'Customer',
      email: customerEmail || 'customer@example.com'
    });

    if (!paymentResponse.ResponseStatus) {
      return NextResponse.json(
        { 
          error: 'Failed to initiate Selcom payment',
          details: paymentResponse.ResponseDescription 
        },
        { status: 400 }
      );
    }

    // Generate payment token for return URL
    const paymentToken = encryptToken({ invoiceId: orderId });

    return NextResponse.json({
      success: true,
      message: 'Selcom payment initiated successfully',
      reference: paymentResponse.ReferenceID,
      transid: paymentResponse.transid,
      paymentToken,
      instructions: [
        'Please complete the payment using the provided reference',
        'You can pay via mobile money or banking channels',
        'You will receive a confirmation once payment is complete'
      ]
    });

  } catch (error) {
    console.error('[Selcom] Payment initiation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initiate Selcom payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Check Selcom payment status
 * GET /api/payment/selcom?orderId=xxx
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

    // Get Selcom configuration
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: 'selcom' }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Selcom is not configured or inactive' },
        { status: 400 }
      );
    }

    // Type assertion for new fields
    const config = gatewayConfig as any;

    // Initialize Selcom client
    const selcomClient = createSelcomClient({
      apiKey: config.selcomApiKey!,
      secretKey: config.selcomSecretKey!,
      vendorName: config.selcomVendorName!,
      environment: config.selcomEnvironment as 'sandbox' | 'production'
    });

    // Check payment status
    const statusResponse = await selcomClient.checkPaymentStatus(orderId);

    return NextResponse.json({
      success: true,
      data: statusResponse
    });

  } catch (error) {
    console.error('[Selcom] Status check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check Selcom payment status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Push USSD request for Selcom
 * POST /api/payment/selcom/ussd
 */
export async function USSD(request: Request) {
  try {
    const body = await request.json();
    const { orderId, amount, customerPhone } = body;

    // Validate required fields
    if (!orderId || !amount || !customerPhone) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, amount, customerPhone' },
        { status: 400 }
      );
    }

    // Get Selcom configuration
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: 'selcom' }
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Selcom is not configured or inactive' },
        { status: 400 }
      );
    }

    // Type assertion for new fields
    const config = gatewayConfig as any;

    if (!config.selcomApiKey || !config.selcomSecretKey || !config.selcomVendorName) {
      return NextResponse.json(
        { error: 'Selcom configuration is incomplete' },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumberForSelcom(customerPhone);
    
    // Initialize Selcom client
    const selcomClient = createSelcomClient({
      apiKey: config.selcomApiKey!,
      secretKey: config.selcomSecretKey!,
      vendorName: config.selcomVendorName!,
      environment: config.selcomEnvironment as 'sandbox' | 'production'
    });

    // Push USSD request
    const ussdResponse = await selcomClient.pushUssdRequest({
      orderId,
      amount: parseInt(amount),
      phoneNumber: formattedPhone,
      description: `Payment for order ${orderId}`
    });

    if (ussdResponse.api_status !== 200) {
      return NextResponse.json(
        { 
          error: 'Failed to push USSD request',
          details: ussdResponse.message 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'USSD push sent successfully',
      reference: ussdResponse.reference,
      instructions: [
        'Please check your phone for the USSD prompt',
        'Follow the instructions to complete the payment',
        'You will receive a confirmation once payment is complete'
      ]
    });

  } catch (error) {
    console.error('[Selcom] USSD push error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to push USSD request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
