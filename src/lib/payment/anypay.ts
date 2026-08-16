// lib/payment/anypay.ts
import axios from 'axios';

const ANYPAY_BASE_URL = 'https://anypaytanzania.com/api/payments';

export function formatPhoneForAnyPay(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  // Remove country code if present
  if (cleaned.startsWith('255')) {
    cleaned = cleaned.substring(3);
  }
  // Ensure it starts with 0 (local format)
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  // Ensure it's at least 10 digits
  if (cleaned.length < 10) {
    // Pad with zeros? Better to keep as is.
  }
  return cleaned;
}

export async function createAnyPayOrder(apiKey: string, phone: string, amount: number) {
  if (!apiKey) throw new Error('AnyPay API key is required');

  const formattedPhone = formatPhoneForAnyPay(phone);
  console.log('[AnyPay] Creating order for phone:', formattedPhone, 'amount:', amount);

  try {
    const response = await axios.post(
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

    console.log('[AnyPay] Order creation response:', JSON.stringify(response.data, null, 2));

    if (!response.data.payment_url) {
      throw new Error('AnyPay did not return a payment_url');
    }

    return response.data;
  } catch (error: any) {
    console.error('[AnyPay] API Error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config,
    });
    throw new Error(error.response?.data?.message || error.message || 'Failed to create AnyPay order');
  }
}

export async function checkAnyPayOrderStatus(apiKey: string, orderId: string) {
  if (!apiKey) throw new Error('AnyPay API key is required');

  try {
    const response = await axios.get(
      `${ANYPAY_BASE_URL}/check-order-status/?order_id=${orderId}`,
      {
        headers: { 'API-Key': apiKey },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[AnyPay] Status check error:', error.response?.data || error.message);
    throw new Error('Failed to check AnyPay order status');
  }
}