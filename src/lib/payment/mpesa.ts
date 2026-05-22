import crypto from 'crypto'

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
  environment: 'sandbox' | 'production';
}

interface MpesaStkPushParams {
  phoneNumber: string;
  amount: number;
  reference: string;
  description: string;
}

interface MpesaResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID?: string;
  CustomerMessage?: string;
}

export class MpesaPayment {
  private config: MpesaConfig;
  private baseUrl: string;

  constructor(config: MpesaConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Generate OAuth token for M-Pesa API
   */
  private async getOAuthToken(): Promise<string> {
    const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
    
    try {
      const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('Failed to get M-Pesa OAuth token');
      }

      return data.access_token;
    } catch (error) {
      console.error('M-Pesa OAuth error:', error);
      throw error;
    }
  }

  /**
   * Generate timestamp for M-Pesa API
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  /**
   * Generate password for STK push
   */
  private generateStkPassword(timestamp: string): string {
    const passwordString = `${this.config.passkey}${this.config.shortcode}${timestamp}`;
    return crypto.createHash('sha256').update(passwordString).digest('base64');
  }

  /**
   * Generate signature for M-Pesa callback validation
   */
  public generateCallbackSignature(
    timestamp: string,
    amount: string,
    reference: string,
    phoneNumber: string
  ): string {
    const signatureString = `${this.config.consumerSecret}${timestamp}${amount}${reference}${phoneNumber}`;
    return crypto.createHash('sha256').update(signatureString).digest('hex');
  }

  /**
   * Initiate STK Push
   */
  async initiateStkPush(params: MpesaStkPushParams): Promise<MpesaResponse> {
    const token = await this.getOAuthToken();
    const timestamp = this.generateTimestamp();
    const password = this.generateStkPassword(timestamp);

    const payload = {
      BusinessShortCode: this.config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: params.amount,
      PartyA: this.config.shortcode,
      PartyB: params.phoneNumber,
      PhoneNumber: params.phoneNumber,
      CallBackURL: this.config.callbackUrl,
      AccountReference: params.reference,
      TransactionDesc: params.description,
      KeyValue: [
        {
          Key: 'Occasion',
          Value: 'Payment'
        },
        {
          Key: 'Initiator',
          Value: 'Customer'
        }
      ]
    };

    try {
      const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      console.log('[M-Pesa] STK Push Response:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('M-Pesa STK Push error:', error);
      throw error;
    }
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(checkoutRequestID: string): Promise<any> {
    const token = await this.getOAuthToken();
    const timestamp = this.generateTimestamp();
    const password = this.generateStkPassword(timestamp);

    const payload = {
      BusinessShortCode: this.config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID
    };

    try {
      const response = await fetch(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      console.log('[M-Pesa] Status Check Response:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('M-Pesa status check error:', error);
      throw error;
    }
  }

  /**
   * Validate M-Pesa callback signature
   */
  public validateCallbackSignature(
    timestamp: string,
    amount: string,
    reference: string,
    phoneNumber: string,
    signature: string
  ): boolean {
    const expectedSignature = this.generateCallbackSignature(timestamp, amount, reference, phoneNumber);
    return expectedSignature === signature;
  }

  /**
   * Parse M-Pesa callback body
   */
  public parseCallbackBody(body: any): {
    success: boolean;
    transactionId?: string;
    amount?: number;
    phoneNumber?: string;
    reference?: string;
    resultCode?: string;
  } {
    // Handle different callback formats
    if (body.Body && body.Body.stkCallback) {
      const callback = body.Body.stkCallback;
      
      if (callback.ResultCode === '0') {
        return {
          success: true,
          transactionId: callback.MerchantRequestID,
          amount: parseInt(callback.Result?.Amount || '0'),
          phoneNumber: callback.Result?.PhoneNumber,
          reference: callback.Result?.AccountReference,
          resultCode: callback.ResultCode
        };
      } else {
        return {
          success: false,
          resultCode: callback.ResultCode,
          transactionId: callback.MerchantRequestID
        };
      }
    }

    // Alternative callback format
    if (body.stkCallback) {
      const callback = body.stkCallback;
      
      if (callback.ResultCode === '0') {
        return {
          success: true,
          transactionId: callback.MerchantRequestID,
          amount: parseInt(callback.Result?.Amount || '0'),
          phoneNumber: callback.Result?.PhoneNumber,
          reference: callback.Result?.AccountReference,
          resultCode: callback.ResultCode
        };
      } else {
        return {
          success: false,
          resultCode: callback.ResultCode,
          transactionId: callback.MerchantRequestID
        };
      }
    }

    return {
      success: false,
      resultCode: 'UNKNOWN'
    };
  }
}

/**
 * Helper function to initialize M-Pesa
 */
export function createMpesaClient(config: MpesaConfig): MpesaPayment {
  return new MpesaPayment(config);
}

/**
 * Format phone number for M-Pesa (remove country code if present and ensure 254 prefix)
 */
export function formatPhoneNumberForMpesa(phone: string): string {
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
  
  // Add 254 prefix
  return `254${cleanedPhone}`;
}
