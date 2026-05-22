import axios from "axios";

const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortcode = process.env.MPESA_SHORTCODE;
const passkey = process.env.MPESA_PASSKEY;
const callbackUrl = process.env.MPESA_CALLBACK_URL;
const environment = process.env.MPESA_ENVIRONMENT || "sandbox";

let accessToken = "";

export async function getAccessToken() {
  const url =
    environment === "sandbox"
      ? "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
      : "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  const response = await axios.get(url, {
    auth: {
      username: consumerKey!,
      password: consumerSecret!,
    },
  });
  accessToken = response.data.access_token;
  return accessToken;
}

export async function stkPush(phone: string, amount: number) {
  if (!accessToken) await getAccessToken();

  const url =
    environment === "sandbox"
      ? "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
      : "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:\.Z]/g, "")
    .slice(0, 14);
  const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: "SKYLINK",
    TransactionDesc: "Payment for services",
  };

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return response.data;
}
