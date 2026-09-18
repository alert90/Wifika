// src/lib/payment/pesapal.ts
import axios from 'axios';
import crypto from 'crypto';

const PESAPAL_BASE_URL_SANDBOX = 'https://cybqa.pesapal.com/pesapalv3';
const PESAPAL_BASE_URL_PRODUCTION = 'https://pay.pesapal.com/v3';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface PesapalConfig {
  apiKey: string;
  secretKey: string;
  merchantId: string;
  environment: 'sandbox' | 'production';
}

interface PesapalRequestParams {
  merchant_id: string;
  order_id: string;
  timestamp: string;
  amount?: string;
  [key: string]: string | undefined;
}

interface AuthResponse {
  token: string;
  expiryDate: string;
  error?: { message: string };
  status: string;
}

interface SubmitOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error?: { message: string };
  status: string;
}

interface SubmitOrderParams {
  orderId: string;
  amount: number;
  description: string;
  callbackUrl: string;
  customerEmail?: string;
  customerPhone?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getBaseUrl(environment: 'sandbox' | 'production'): string {
  return environment === 'sandbox'
    ? PESAPAL_BASE_URL_SANDBOX
    : PESAPAL_BASE_URL_PRODUCTION;
}

/**
 * Normalize phone number to international format for Pesapal.
 * Strips non-digits, ensures it starts with 255 (Tanzania).
 */
export function formatPhoneNumberForPesapal(phone: string): string {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '255' + clean.slice(1);
  if (!clean.startsWith('255')) clean = '255' + clean;
  return clean;
}

async function getAccessToken(config: PesapalConfig): Promise<string> {
  const baseUrl = getBaseUrl(config.environment);

  const res = await axios.post<AuthResponse>(
    `${baseUrl}/api/Auth/RequestToken`,
    {
      consumer_key: config.apiKey,
      consumer_secret: config.secretKey,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  if (!res.data.token) {
    throw new Error(
      res.data.error?.message || 'Failed to get Pesapal access token'
    );
  }

  return res.data.token;
}

/* ------------------------------------------------------------------ */
/* Core API functions                                                 */
/* ------------------------------------------------------------------ */

export async function createPesapalOrder(
  config: PesapalConfig,
  params: SubmitOrderParams
): Promise<SubmitOrderResponse> {
  const token = await getAccessToken(config);
  const baseUrl = getBaseUrl(config.environment);
  const now = new Date().toISOString();

  // Build request params — includes amount via typed interface
  const requestParams: PesapalRequestParams = {
    merchant_id: config.merchantId,
    order_id: params.orderId,
    timestamp: now,
  };
  requestParams.amount = params.amount.toString();

  const res = await axios.post<SubmitOrderResponse>(
    `${baseUrl}/api/Transactions/SubmitOrderRequest`,
    {
      id: params.orderId,
      currency: 'TZS',
      amount: params.amount,
      description: params.description,
      callback_url: params.callbackUrl,
      notification_id: params.orderId,
      billing_address: {
        email_address: params.customerEmail || '',
        phone_number: params.customerPhone
          ? formatPhoneNumberForPesapal(params.customerPhone)
          : '',
        country_code: 'TZ',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  if (!res.data.redirect_url) {
    throw new Error(
      res.data.error?.message || 'Failed to create Pesapal order'
    );
  }

  return res.data;
}

export async function checkPesapalTransactionStatus(
  config: PesapalConfig,
  orderTrackingId: string
): Promise<unknown> {
  const token = await getAccessToken(config);
  const baseUrl = getBaseUrl(config.environment);

  const res = await axios.get(
    `${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  return res.data;
}

export function verifyPesapalSignature(
  orderTrackingId: string,
  merchantReference: string,
  amount: string,
  secretKey: string
): string {
  const rawString = `${orderTrackingId}${merchantReference}${amount}`;
  return crypto
    .createHmac('sha256', secretKey)
    .update(rawString)
    .digest('base64');
}

/* ------------------------------------------------------------------ */
/* Client factory — what the pesapal route imports                    */
/* ------------------------------------------------------------------ */

export interface PesapalClient {
  submitOrder: (params: SubmitOrderParams) => Promise<SubmitOrderResponse>;
  getTransactionStatus: (orderTrackingId: string) => Promise<unknown>;
}

/**
 * Create a bound Pesapal client using the given credentials.
 * The route imports this and calls `client.submitOrder(...)`.
 */
export function createPesapalClient(config: PesapalConfig): PesapalClient {
  return {
    submitOrder: (params) => createPesapalOrder(config, params),
    getTransactionStatus: (orderTrackingId) =>
      checkPesapalTransactionStatus(config, orderTrackingId),
  };
}