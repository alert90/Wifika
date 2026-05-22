import crypto from 'crypto'

interface SelcomConfig {
  apiKey: string;
  secretKey: string;
  vendorName: string;
  environment: 'sandbox' | 'production';
}

interface SelcomPaymentParams {
  orderId: string;
  amount: number;
  phoneNumber: string;
  description: string;
  customerName?: string;
  email?: string;
}

interface SelcomPaymentResponse {
  ResponseCode: string;
  ResponseStatus: boolean;
  ResponseDescription: string;
  ReferenceID?: string;
  transid?: string;
  channel?: string;
  amount?: number;
  phone?: string;
  payment_status?: string;
}

interface SelcomPushResponse {
  api_status: number;
  message?: string;
  reference?: string;
}

export class SelcomPayment {
  private config: SelcomConfig;
  private baseUrl: string;

  constructor(config: SelcomConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.selcommobile.com'
      : 'https://api.sandbox.selcommobile.com';
  }

  /**
   * Generate digest for Selcom API authentication
   */
  private generateDigest(timestamp: string): string {
    const digest1 = crypto.createHash('md5').update(timestamp + this.config.secretKey).digest('hex');
    const digest2 = crypto.createHash('sha1').update(timestamp + this.config.apiKey + this.config.secretKey).digest('hex');
    return `${digest1}${digest2}`;
  }

  /**
   * Generate timestamp for Selcom API
   */
  private generateTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  }

  /**
   * Create payment request
   */
  async createPayment(params: SelcomPaymentParams): Promise<SelcomPaymentResponse> {
    const timestamp = this.generateTimestamp();
    const digest = this.generateDigest(timestamp);

    const payload = {
      order_id: params.orderId,
      amount: params.amount,
      currency: 'TZS',
      customer_name: params.customerName || 'Customer',
      customer_email: params.email || 'customer@example.com',
      customer_phone: params.phoneNumber,
      payment_method: 'MOBILEMONEY',
      payment_channel: 'TIGO',
      vendor: this.config.vendorName,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?token=${params.orderId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed?token=${params.orderId}`,
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook`,
      description: params.description,
      metadata: {
        source: 'skylink',
        order_type: 'voucher'
      }
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/paymentorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_key': this.config.apiKey,
          'digest': digest,
          'request_timestamp': timestamp
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      console.log('[Selcom] Payment Response:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Selcom payment error:', error);
      throw error;
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(orderId: string): Promise<SelcomPaymentResponse> {
    const timestamp = this.generateTimestamp();
    const digest = this.generateDigest(timestamp);

    try {
      const response = await fetch(`${this.baseUrl}/v1/paymentStatus/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api_key': this.config.apiKey,
          'digest': digest,
          'request_timestamp': timestamp
        }
      });

      const data = await response.json();
      
      console.log('[Selcom] Status Check Response:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Selcom status check error:', error);
      throw error;
    }
  }

  /**
   * Push USSD request to customer
   */
  async pushUssdRequest(params: SelcomPaymentParams): Promise<SelcomPushResponse> {
    const timestamp = this.generateTimestamp();
    const digest = this.generateDigest(timestamp);

    const payload = {
      order_id: params.orderId,
      amount: params.amount,
      phone: params.phoneNumber,
      user_id: params.orderId, // Using orderId as user_id for tracking
      mno: 'TIGO' // Mobile Network Operator
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/ussdpush`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_key': this.config.apiKey,
          'digest': digest,
          'request_timestamp': timestamp
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      console.log('[Selcom] USSD Push Response:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Selcom USSD push error:', error);
      throw error;
    }
  }

  /**
   * Validate Selcom webhook signature
   */
  public validateWebhookSignature(
    timestamp: string,
    signature: string
  ): boolean {
    const expectedDigest = this.generateDigest(timestamp);
    return expectedDigest === signature;
  }

  /**
   * Parse Selcom webhook body
   */
  public parseWebhookBody(body: any): {
    success: boolean;
    orderId?: string;
    transactionId?: string;
    amount?: number;
    phoneNumber?: string;
    paymentStatus?: string;
    channel?: string;
  } {
    // Handle Selcom webhook format
    if (body.order_id && body.payment_status) {
      const isCompleted = body.payment_status === 'COMPLETED';
      
      return {
        success: isCompleted,
        orderId: body.order_id,
        transactionId: body.transid,
        amount: body.amount,
        phoneNumber: body.phone,
        paymentStatus: body.payment_status,
        channel: body.channel
      };
    }

    return {
      success: false
    };
  }

  /**
   * Verify payment from webhook
   */
  async verifyPayment(orderId: string): Promise<SelcomPaymentResponse> {
    try {
      const response = await this.checkPaymentStatus(orderId);
      
      if (response.payment_status === 'COMPLETED') {
        return {
          ...response,
          ResponseStatus: true,
          ResponseDescription: 'Payment completed successfully'
        };
      }
      
      return {
        ...response,
        ResponseStatus: false,
        ResponseDescription: 'Payment not completed'
      };
    } catch (error) {
      console.error('Selcom payment verification error:', error);
      throw error;
    }
  }
}

/**
 * Helper function to initialize Selcom
 */
export function createSelcomClient(config: SelcomConfig): SelcomPayment {
  return new SelcomPayment(config);
}

/**
 * Format phone number for Selcom (ensure proper format)
 */
export function formatPhoneNumberForSelcom(phone: string): string {
  // Remove all non-digit characters
  let cleanedPhone = phone.replace(/\D/g, '');
  
  // Remove leading 255 if present, then add it
  if (cleanedPhone.startsWith('255')) {
    cleanedPhone = cleanedPhone.substring(3);
  }
  
  // Remove leading 0 if present
  if (cleanedPhone.startsWith('0')) {
    cleanedPhone = cleanedPhone.substring(1);
  }
  
  // Add 255 prefix
  return `255${cleanedPhone}`;
}
