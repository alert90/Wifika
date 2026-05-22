// src/payment/mpesa.ts
import axios from 'axios';

const baseURL = process.env.MPESA_ENVIRONMENT === 'sandbox'
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

export async function stkPush(phone: string, amount: number, accountRef = 'SKYLINK') {
  const token = await getAccessToken();
  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: process.env.MPESA_PASSKEY,
    Timestamp: getTimestamp(),
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: accountRef,
    TransactionDesc: 'Payment for WiFi',
  };

  return axios.post(`${baseURL}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// implement getAccessToken() and getTimestamp() based on Daraja API
