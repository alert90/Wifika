import crypto from 'crypto'

interface PesapalConfig {
  merchantId: string;
  apiKey: string;
  secretKey: string;
  environment: 'sandbox' | 'production';
}

interface PesapalPaymentParams {
  orderId: string;
  amount: number;
  phoneNumber: string;
  description: string;
  customerName?: string;
  email?: string;
}

interface PesapalPaymentResponse {
  success: boolean;
  reference?: string;
  paymentUrl?: string;
  message?: string;
}

interface PesapalStatusResponse {
  success: boolean;
  status?: string;
  reference?: string;
  amount?: number;
  message?: string;
}

export class PesapalPayment {
  private config: PesapalConfig;
  private baseUrl: string;

  constructor(config: PesapalConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.pesapal.com'
      : 'https://sandbox.pesapal.com';
  }

  /**
   * Generate signature for Pesapal API
   */
  private generateSignature(params: Record<string, string>): string {
    // Sort parameters alphabetically
    const sortedKeys = Object.keys(params).sort();
    let queryString = '';
    
    sortedKeys.forEach(key => {
      if (queryString) queryString += '&';
      queryString += `${key}=${params[key]}`;
    });
    
    // Remove leading '&'
    queryString = queryString.substring(1);
    
    // Append secret key
    const signatureString = `${queryString}&${this.config.secretKey}`;
    
    return crypto.createHash('sha256').update(signatureString).digest('hex');
  }

  /**
   * Create payment request
   */
  async createPayment(params: PesapalPaymentParams): Promise<PesapalPaymentResponse> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const requestParams = {
      merchant_id: this.config.merchantId,
      order_id: params.orderId,
      amount: params.amount.toString(),
      currency: 'TZS',
      customer_name: params.customerName || 'Customer',
      customer_email: params.email || 'customer@example.com',
      customer_phone: params.phoneNumber,
      payment_method: 'MOBILE',
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?token=${params.orderId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed?token=${params.orderId}`,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook`,
      description: params.description,
      timestamp: timestamp
    };

    const signature = this.generateSignature(requestParams);

    try {
      const response = await fetch(`${this.baseUrl}/v1/payment/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Signature': signature
        },
        body: JSON.stringify(requestParams)
      });

      const data = await response.json();
      
      console.log('[Pesapal] Payment Response:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Pesapal payment error:', error);
      throw error;
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(orderId: string): Promise<PesapalStatusResponse> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const requestParams = {
      merchant_id: this.config.merchantId,
      order_id: orderId,
      timestamp: timestamp
    };

    const signature = this.generateSignature(requestParams);

    try {
      const response = await fetch(`${this.baseUrl}/v1/payment/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Signature': signature
        },
        body: JSON.stringify(requestParams)
      });

      const data = await response.json();
      
      console.log('[Pesapal] Status Check Response:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Pesapal status check error:', error);
      throw error;
    }
  }

  /**
   * Validate Pesapal webhook signature
   */
  public validateWebhookSignature(
    timestamp: string,
    signature: string,
    params: Record<string, string>
  ): boolean {
    // Add secret key to params for signature validation
    const paramsWithSecret = { ...params, secret_key: this.config.secretKey };
    
    const expectedSignature = this.generateSignature(paramsWithSecret);
    return expectedSignature === signature;
  }

  /**
   * Parse Pesapal webhook body
   */
  public parseWebhookBody(body: any): {
    success: boolean;
    orderId?: string;
    transactionId?: string;
    amount?: number;
    phoneNumber?: string;
    status?: string;
  } {
    // Handle Pesapal webhook format
    if (body.order_id && body.status) {
      const isCompleted = body.status === 'completed';
      
      return {
        success: isCompleted,
        orderId: body.order_id,
        transactionId: body.transaction_id,
        amount: parseFloat(body.amount) || 0,
        phoneNumber: body.customer_phone,
        status: body.status
      };
    }

    return {
      success: false
    };
  }

  /**
   * Verify payment from webhook
   */
  async verifyPayment(orderId: string): Promise<PesapalStatusResponse> {
    try {
      const response = await this.checkPaymentStatus(orderId);
      
      if (response.status === 'completed') {
        return {
          ...response,
          success: true,
          message: 'Payment completed successfully'
        };
      }
      
      return {
        ...response,
        success: false,
        message: 'Payment not completed'
      };
    } catch (error) {
      console.error('Pesapal payment verification error:', error);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(orderId: string, amount?: number): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const requestParams = {
      merchant_id: this.config.merchantId,
      order_id: orderId,
      timestamp: timestamp
    };

    if (amount) {
      requestParams.amount = amount.toString();
    }

    const signature = this.generateSignature(requestParams);

    try {
      const response = await fetch(`${this.baseUrl}/v1/payment/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Signature': signature
        },
        body: JSON.stringify(requestParams)
      });

      const data = await response.json();
      
      console.log('[Pesapal] Refund Response:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Pesapal refund error:', error);
      throw error;
    }
  }
}

/**
 * Helper function to initialize Pesapal
 */
export function createPesapalClient(config: PesapalConfig): PesapalPayment {
  return new PesapalPayment(config);
}

/**
 * Format phone number for Pesapal (ensure proper format)
 */
export function formatPhoneNumberForPesapal(phone: string): string {
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
