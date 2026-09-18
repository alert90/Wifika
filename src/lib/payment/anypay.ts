// lib/payment/anypay.ts
import axios from 'axios';

const ANYPAY_BASE_URL = 'https://anypaytanzania.com/api/payments';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface WalletPullParams {
  orderId: string;
  phone: string;
  amount: number;
  webhookUrl: string;
  webhookVersion?: 1 | 2;
}

/** Shape of AnyPay's raw wallet/pull response (fields are all optional). */
export interface AnyPayWalletPullRawResponse {
  status?: string;
  resultcode?: string;
  code?: string;
  message?: string;
  order_id?: string;
  transid?: string;
  msisdn?: string;
  payment_reference?: string;
}

export interface WalletPullResult {
  success: boolean;
  orderId: string;
  transId?: string;
  msisdn?: string;
  paymentReference?: string;
  message?: string;
  raw: AnyPayWalletPullRawResponse;
}

export interface AnyPayStatusResponse {
  status?: string;
  resultcode?: string;
  code?: string;
  message?: string;
  order_id?: string;
  transid?: string;
  amount?: number | string;
  [key: string]: unknown;
}

export interface LegacyCashInResponse {
  payment_url: string;
  [key: string]: unknown;
}

/** Minimal shape of an axios-style error we care about. */
interface HttpLikeError {
  message?: string;
  response?: {
    status?: number;
    data?: { message?: string } | unknown;
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

export function formatPhoneForAnyPay(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('255')) cleaned = cleaned.substring(3);
  if (!cleaned.startsWith('0')) cleaned = '0' + cleaned;
  return cleaned;
}

/* ------------------------------------------------------------------ */
/* Wallet Pull (preferred — STK push, async via webhook)              */
/* ------------------------------------------------------------------ */

export async function createAnyPayWalletPull(
  apiKey: string,
  params: WalletPullParams
): Promise<WalletPullResult> {
  if (!apiKey) throw new Error('AnyPay API key is required');

  const { orderId, phone, amount, webhookUrl, webhookVersion = 2 } = params;
  const formattedPhone = formatPhoneForAnyPay(phone);

  console.log('[AnyPay WalletPull] Initiating:', {
    orderId,
    phone: formattedPhone,
    amount,
    webhookUrl,
    webhookVersion,
  });

  try {
    const body: Record<string, string | number> = {
      order_id: orderId,
      phone: formattedPhone,
      amount: Math.round(amount),
      webhook_url: webhookUrl,
    };
    if (webhookVersion === 2) body.webhook_version = 2;

    const response = await axios.post<AnyPayWalletPullRawResponse>(
      `${ANYPAY_BASE_URL}/wallet/pull/`,
      body,
      {
        headers: {
          'API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const data = response.data;
    console.log('[AnyPay WalletPull] Response:', JSON.stringify(data, null, 2));

    const ok =
      data?.status === 'success' ||
      data?.resultcode === '000' ||
      data?.code === '00';

    if (!ok) {
      throw new Error(data?.message || 'AnyPay wallet pull was rejected');
    }

    return {
      success: true,
      orderId: data.order_id || orderId,
      transId: data.transid,
      msisdn: data.msisdn,
      paymentReference: data.payment_reference,
      message: data.message || 'Request in progress...',
      raw: data,
    };
  } catch (error: unknown) {
    const err = error as HttpLikeError;
    console.error('[AnyPay WalletPull] Error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    const serverMsg =
      typeof err.response?.data === 'object' &&
      err.response?.data !== null &&
      'message' in err.response.data
        ? (err.response.data as { message?: string }).message
        : undefined;

    throw new Error(
      serverMsg ||
        err.message ||
        'Failed to initiate AnyPay wallet pull'
    );
  }
}

/* ------------------------------------------------------------------ */
/* Status check (fallback for missed webhooks)                        */
/* ------------------------------------------------------------------ */

export async function checkAnyPayOrderStatus(
  apiKey: string,
  orderId: string
): Promise<AnyPayStatusResponse> {
  if (!apiKey) throw new Error('AnyPay API key is required');
  try {
    const response = await axios.get<AnyPayStatusResponse>(
      `${ANYPAY_BASE_URL}/check-order-status/?order_id=${orderId}`,
      { headers: { 'API-Key': apiKey }, timeout: 10000 }
    );
    return response.data;
  } catch (error: unknown) {
    const err = error as HttpLikeError;
    console.error(
      '[AnyPay] Status check error:',
      err.response?.data || err.message
    );
    throw new Error('Failed to check AnyPay order status');
  }
}

/* ------------------------------------------------------------------ */
/* Legacy cash-in — DO NOT use in new code                            */
/* ------------------------------------------------------------------ */

/** @deprecated Use `createAnyPayWalletPull` instead. */
export async function createAnyPayOrder(
  apiKey: string,
  phone: string,
  amount: number
): Promise<LegacyCashInResponse> {
  if (!apiKey) throw new Error('AnyPay API key is required');

  const formattedPhone = formatPhoneForAnyPay(phone);
  console.log('[AnyPay] (legacy) Creating cash-in order for:', formattedPhone);

  try {
    const response = await axios.post<LegacyCashInResponse>(
      `${ANYPAY_BASE_URL}/create-order-minimal/`,
      {
        buyer_phone: formattedPhone,
        amount: Math.round(amount),
      },
      {
        headers: {
          'API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    if (!response.data.payment_url) {
      throw new Error('AnyPay did not return a payment_url');
    }
    return response.data;
  } catch (error: unknown) {
    const err = error as HttpLikeError;
    console.error('[AnyPay] API Error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw new Error(err.message || 'Failed to create AnyPay order');
  }
}