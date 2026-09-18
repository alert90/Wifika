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

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  currency?: string;
  description: string;
  callbackUrl: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
}

export interface CreatePaymentResult {
  success: boolean;
  orderTrackingId?: string;
  merchantReference?: string;
  redirectUrl?: string;
  error?: string;
  raw?: SubmitOrderResponse;
}

export interface CheckPaymentStatusResult {
  success: boolean;
  status?: string;
  amount?: number;
  paymentMethod?: string;
  confirmationCode?: string;
  error?: string;
  raw?: unknown;
}

export interface RefundPaymentResult {
  success: boolean;
  refundId?: string;
  status?: string;
  error?: string;
  raw?: unknown;
}

export interface PesapalClient {
  createPayment: (params: CreatePaymentParams) => Promise<CreatePaymentResult>;
  checkPaymentStatus: (
    orderTrackingId: string
  ) => Promise<CheckPaymentStatusResult>;
  refundPayment: (
    orderTrackingId: string,
    amount?: number
  ) => Promise<RefundPaymentResult>;

  // Legacy names kept for compatibility
  submitOrder: (params: CreatePaymentParams) => Promise<SubmitOrderResponse>;
  getTransactionStatus: (orderTrackingId: string) => Promise<unknown>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getBaseUrl(environment: 'sandbox' | 'production'): string {
  return environment === 'sandbox'
    ? PESAPAL_BASE_URL_SANDBOX
    : PESAPAL_BASE_URL_PRODUCTION;
}

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
/* Raw Pesapal API calls                                              */
/* ------------------------------------------------------------------ */

async function submitOrderRaw(
  config: PesapalConfig,
  params: CreatePaymentParams
): Promise<SubmitOrderResponse> {
  const token = await getAccessToken(config);
  const baseUrl = getBaseUrl(config.environment);

  const res = await axios.post<SubmitOrderResponse>(
    `${baseUrl}/api/Transactions/SubmitOrderRequest`,
    {
      id: params.orderId,
      currency: params.currency || 'TZS',
      amount: params.amount,
      description: params.description,
      callback_url: params.callbackUrl,
      notification_id: params.orderId,
      billing_address: {
        email_address: params.customerEmail || '',
        phone_number: params.customerPhone
          ? formatPhoneNumberForPesapal(params.customerPhone)
          : '',
        first_name: params.customerName?.split(' ')[0] || '',
        last_name: params.customerName?.split(' ').slice(1).join(' ') || '',
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

  return res.data;
}

async function getTransactionStatusRaw(
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

async function requestRefundRaw(
  config: PesapalConfig,
  orderTrackingId: string,
  amount?: number
): Promise<unknown> {
  const token = await getAccessToken(config);
  const baseUrl = getBaseUrl(config.environment);

  const res = await axios.post(
    `${baseUrl}/api/Transactions/RefundRequest`,
    {
      confirmation_code: orderTrackingId,
      amount: amount ?? undefined,
      username: config.merchantId,
      remarks: 'Refund requested from admin panel',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  return res.data;
}

/* ------------------------------------------------------------------ */
/* Client factory — what the pesapal route imports                    */
/* ------------------------------------------------------------------ */

interface RawStatusResponse {
  status?: string;
  payment_status_description?: string;
  amount?: number | string;
  payment_method?: string;
  confirmation_code?: string;
  error?: { message?: string };
  [key: string]: unknown;
}

interface RawRefundResponse {
  status?: string;
  refund_id?: string;
  error?: { message?: string };
  [key: string]: unknown;
}

export function createPesapalClient(config: PesapalConfig): PesapalClient {
  return {
    async createPayment(
      params: CreatePaymentParams
    ): Promise<CreatePaymentResult> {
      try {
        const result = await submitOrderRaw(config, params);

        if (!result.redirect_url || !result.order_tracking_id) {
          return {
            success: false,
            error:
              result.error?.message || 'Pesapal did not return a redirect URL',
            raw: result,
          };
        }

        return {
          success: true,
          orderTrackingId: result.order_tracking_id,
          merchantReference: result.merchant_reference,
          redirectUrl: result.redirect_url,
          raw: result,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: msg };
      }
    },

    async checkPaymentStatus(
      orderTrackingId: string
    ): Promise<CheckPaymentStatusResult> {
      try {
        const raw = (await getTransactionStatusRaw(
          config,
          orderTrackingId
        )) as RawStatusResponse;

        return {
          success: true,
          status:
            raw.payment_status_description || raw.status || 'UNKNOWN',
          amount: raw.amount ? Number(raw.amount) : undefined,
          paymentMethod: raw.payment_method,
          confirmationCode: raw.confirmation_code,
          raw,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: msg };
      }
    },

    async refundPayment(
      orderTrackingId: string,
      amount?: number
    ): Promise<RefundPaymentResult> {
      try {
        const raw = (await requestRefundRaw(
          config,
          orderTrackingId,
          amount
        )) as RawRefundResponse;

        return {
          success: true,
          refundId: raw.refund_id,
          status: raw.status,
          raw,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: msg };
      }
    },

    // ---- Legacy names, kept so older code still compiles ----
    async submitOrder(params: CreatePaymentParams) {
      return submitOrderRaw(config, params);
    },

    async getTransactionStatus(orderTrackingId: string) {
      return getTransactionStatusRaw(config, orderTrackingId);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Standalone exports (kept for other callers)                        */
/* ------------------------------------------------------------------ */

export async function createPesapalOrder(
  config: PesapalConfig,
  params: CreatePaymentParams
): Promise<SubmitOrderResponse> {
  return submitOrderRaw(config, params);
}

export async function checkPesapalTransactionStatus(
  config: PesapalConfig,
  orderTrackingId: string
): Promise<unknown> {
  return getTransactionStatusRaw(config, orderTrackingId);
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