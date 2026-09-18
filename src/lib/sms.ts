// src/lib/sms.ts
import { prisma } from '@/lib/prisma';

interface AnyPaySmsResponse {
  code: number;
  success: boolean;
  message: string;
  balance_info?: {
    current_balance: number;
    required_segments: number;
    can_send: boolean;
    additional_credits_needed: number;
    characters?: {
      total: number;
      per_segment: number;
      segments_breakdown: string;
    };
  };
  data?: {
    id: string;
    sender_id: string;
    message: string;
    contacts: string;
    valid_contacts: number;
    invalid_contacts: number;
    success: boolean;
    created_at: string;
  };
}

class SMSService {
  /**
   * Send an SMS via AnyPay Tanzania.
   * AnyPay accepts local format (07XXXXXXXX) or international (255XXXXXXXXX).
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      const gateway = await prisma.paymentGateway.findFirst({
        where: { provider: 'anypay', isActive: true },
        select: { anypayApiKey: true },
      });

      if (!gateway?.anypayApiKey) {
        console.warn('[SMS] AnyPay API key not configured');
        return false;
      }

      // Normalize to local format 07XXXXXXXX
      let cleanPhone = to.replace(/\D/g, '');
      if (cleanPhone.startsWith('255')) {
        cleanPhone = '0' + cleanPhone.substring(3);
      }
      if (!cleanPhone.startsWith('0')) {
        cleanPhone = '0' + cleanPhone;
      }

      const res = await fetch('https://anypaytanzania.com/api/sms/send/', {
        method: 'POST',
        headers: {
          'API-Key': gateway.anypayApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_id: 'SKYLINK',
          message,
          contacts: cleanPhone,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('[SMS/AnyPay] HTTP error:', res.status, text);
        return false;
      }

      const data = (await res.json()) as AnyPaySmsResponse;

      if (!data.success) {
        console.error('[SMS/AnyPay] API error:', data.message);
        return false;
      }

      console.log(
        `[SMS/AnyPay] Sent to ${cleanPhone} — balance: ${
          data.balance_info?.current_balance ?? '?'
        }`
      );
      return true;
    } catch (error) {
      console.error('[SMS/AnyPay] Exception:', error);
      return false;
    }
  }

  /* ---------------- High-level helpers ---------------- */

  async sendVoucherCode(
    phone: string,
    code: string,
    orderNumber: string
  ): Promise<boolean> {
    return this.sendSMS(
      phone,
      `Your WiFi voucher is ready!\nCode: ${code}\nOrder: ${orderNumber}\nConnect to WiFi and enter the code. - SKYLINK`
    );
  }

  async sendPaymentConfirmation(
    phone: string,
    amount: number,
    receiptNumber: string
  ): Promise<boolean> {
    return this.sendSMS(
      phone,
      `Payment confirmed! TZS ${amount.toLocaleString()} received. Receipt: ${receiptNumber}. Your internet access is now active. - SKYLINK`
    );
  }

  async sendSessionExpiry(phone: string, planName: string): Promise<boolean> {
    return this.sendSMS(
      phone,
      `Your ${planName} internet session has expired. Visit our portal to purchase a new plan. - SKYLINK`
    );
  }

  async sendWelcomeMessage(phone: string, firstName?: string): Promise<boolean> {
    const name = firstName ? ` ${firstName}` : '';
    return this.sendSMS(
      phone,
      `Welcome${name} to SKYLINK! Your account has been created successfully. Connect to our WiFi and enjoy high-speed internet.`
    );
  }

  async sendOTP(phone: string, otp: string): Promise<boolean> {
    return this.sendSMS(
      phone,
      `Your SKYLINK verification code is: ${otp}. Expires in 10 minutes. Do not share this code.`
    );
  }

  async sendLowBalanceAlert(
    phone: string,
    remainingTime: string
  ): Promise<boolean> {
    return this.sendSMS(
      phone,
      `Your internet session expires in ${remainingTime}. Top up now to avoid disconnection. - SKYLINK`
    );
  }

  async sendPasswordReset(phone: string, resetCode: string): Promise<boolean> {
    return this.sendSMS(
      phone,
      `Your SKYLINK password reset code is: ${resetCode}. Code expires in 15 minutes.`
    );
  }

  async sendBulkSMS(
    phones: string[],
    message: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const phone of phones) {
      const sent = await this.sendSMS(phone, message);
      if (sent) success++;
      else failed++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { success, failed };
  }
}

const smsService = new SMSService();

export default smsService;
export { smsService };