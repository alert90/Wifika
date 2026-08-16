// app/api/payment/webhook/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncVoucherToRadius } from '@/lib/hotspot-radius-sync';
import { sendPaymentSuccess, sendVoucherPurchaseSuccess } from '@/lib/whatsapp-notifications';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let webhookLogId: string | undefined;
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.text();
      body = Object.fromEntries(new URLSearchParams(formData));
    } else {
      body = await request.json();
    }

    console.log('=== PAYMENT WEBHOOK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Content-Type:', contentType);
    console.log('Raw Body:', JSON.stringify(body, null, 2));

    const payload = (body && body.event && body.data) ? body.data : body;

    let gateway = 'unknown';
    let orderId = '';
    let status = '';
    let transactionId = '';
    let paymentType = '';
    let paidAt: Date | null = null;
    let amount: number | undefined;

    // ============================================
    // DETECT PAYMENT GATEWAY
    // ============================================

    // MPESA
    if (body.Body && body.Body.stkCallback) {
      gateway = 'mpesa';
      const callback = body.Body.stkCallback;
      orderId = callback.CallbackMetadata?.Item?.find((item: any) => item.Name === 'AccountReference')?.Value || '';
      transactionId = callback.MerchantRequestID || '';
      paymentType = 'stk_push';
      if (callback.ResultCode === '0') {
        status = 'settlement';
        paidAt = new Date();
        const amountItem = callback.CallbackMetadata?.Item?.find((item: any) => item.Name === 'Amount');
        amount = amountItem ? parseInt(amountItem.Value) : undefined;
      } else {
        status = 'failed';
      }
      console.log('[M-Pesa] Webhook processed');
    }
    // SELCOM
    else if (payload.order_id && payload.payment_status) {
      gateway = 'selcom';
      orderId = payload.order_id;
      transactionId = payload.transid || '';
      paymentType = payload.channel || 'mobile_money';
      amount = payload.amount ? parseInt(payload.amount) : undefined;
      if (payload.payment_status === 'COMPLETED') {
        status = 'settlement';
        paidAt = new Date();
      } else if (payload.payment_status === 'PENDING') {
        status = 'pending';
      } else {
        status = 'failed';
      }
      console.log('[Selcom] Webhook processed');
    }
    // PESAPAL
    else if (payload.order_id && payload.status) {
      gateway = 'pesapal';
      orderId = payload.order_id;
      transactionId = payload.transaction_id || '';
      paymentType = 'mobile';
      amount = payload.amount ? parseFloat(payload.amount) : undefined;
      if (payload.status === 'completed') {
        status = 'settlement';
        paidAt = new Date();
      } else if (payload.status === 'pending') {
        status = 'pending';
      } else {
        status = 'failed';
      }
      console.log('[Pesapal] Webhook processed');
    }
    // ANYPAY
    else if (payload.order_id && (payload.status || payload.anypay_payment_status)) {
      gateway = 'anypay';
      orderId = payload.order_id;
      transactionId = payload.transid || payload.reference || payload.anypay_transid || '';
      amount = payload.amount || payload.anypay_amount 
        ? parseFloat(payload.amount || payload.anypay_amount) 
        : undefined;
      
      const anypayStatus = (payload.status || payload.anypay_payment_status || '').toUpperCase();
      
      if (anypayStatus === 'COMPLETED' || anypayStatus === 'SUCCESS') {
        status = 'settlement';
        paidAt = new Date();
      } else if (anypayStatus === 'PENDING' || anypayStatus === 'PROCESSING') {
        status = 'pending';
      } else {
        status = 'failed';
      }
      
      console.log('[AnyPay] Webhook processed:', { orderId, status, transactionId, amount });
    }
    else {
      console.log('Unknown webhook payload format. Returning 200 to avoid retries.');
      return NextResponse.json({ success: true, message: 'Webhook received but format unknown' });
    }

    console.log(`Processing: ${gateway.toUpperCase()} | Order: ${orderId} | Status: ${status}`);

    // Log webhook
    const existingLog = await prisma.webhookLog.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingLog) {
      const webhookLog = await prisma.webhookLog.update({
        where: { id: existingLog.id },
        data: {
          gateway,
          status,
          transactionId,
          amount,
          payload: JSON.stringify(body),
          success: true,
        },
      });
      webhookLogId = webhookLog.id;
    } else {
      const webhookLog = await prisma.webhookLog.create({
        data: {
          id: crypto.randomUUID(),
          gateway,
          orderId,
          status,
          transactionId,
          amount,
          payload: JSON.stringify(body),
          success: true,
        },
      });
      webhookLogId = webhookLog.id;
    }

    // ============================================
    // DETECT ORDER TYPE & HANDLE
    // ============================================
    // Try both voucher and invoice lookup
    const orderType = await determineOrderType(orderId);
    if (orderType === 'voucher') {
      await handleVoucherOrder(orderId, status, gateway, paymentType, paidAt);
    } else if (orderType === 'invoice') {
      await handleInvoicePayment(orderId, status, gateway, paymentType, paidAt);
    } else {
      console.log(`Order not found for ${orderId}, skipping update`);
    }

    if (webhookLogId) {
      await prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          response: JSON.stringify({ success: true, gateway, status, orderId }),
        },
      });
    }

    return NextResponse.json({ success: true, gateway, status, orderId, message: 'Webhook processed' });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ success: true, error: 'Webhook processing failed but acknowledged' });
  }
}

// Helper: determine order type by checking existence in both tables
async function determineOrderType(orderId: string): Promise<'voucher' | 'invoice' | null> {
  // Check voucher by gatewayOrderId or orderNumber
  let found = await prisma.voucherOrder.findFirst({
    where: { gatewayOrderId: orderId },
  });
  if (!found) {
    // Try orderNumber
    const parts = orderId.split('-');
    if (parts.length >= 3 && parts[0] === 'EVC') {
      const orderNumber = parts.slice(0, 3).join('-');
      found = await prisma.voucherOrder.findFirst({
        where: { orderNumber },
      });
    }
  }
  if (found) return 'voucher';

  // Check invoice by gatewayOrderId or invoiceNumber
  found = await prisma.invoice.findFirst({
    where: { gatewayOrderId: orderId },
  });
  if (!found) {
    const parts = orderId.split('-');
    if (parts.length >= 3 && parts[0] === 'INV') {
      const invoiceNumber = parts.slice(1, -1).join('-');
      found = await prisma.invoice.findFirst({
        where: { invoiceNumber },
      });
    }
  }
  if (found) return 'invoice';

  return null;
}

// ============================================
// HANDLE VOUCHER ORDER PAYMENT
// ============================================
async function handleVoucherOrder(
  orderId: string,
  status: string,
  gateway: string,
  paymentType: string,
  paidAt: Date | null
) {
  // Find order by gatewayOrderId first
  let order = await prisma.voucherOrder.findFirst({
    where: { paymentToken: orderId },
    include: { profile: true },
  });

  if (!order) {
    // Fallback: parse orderNumber
    const parts = orderId.split('-');
    if (parts.length >= 3 && parts[0] === 'EVC') {
      const orderNumber = parts.slice(0, 3).join('-');
      order = await prisma.voucherOrder.findFirst({
        where: { orderNumber },
        include: { profile: true },
      });
    }
  }

  if (!order) {
    console.error(`❌ Voucher order not found for orderId: ${orderId}`);
    return;
  }

  console.log(`✅ Voucher order found: ${order.orderNumber}`);

  if (status === 'settlement' || status === 'capture') {
    if (order.status !== 'PAID') {
      // Update order
      await prisma.voucherOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: paidAt || new Date(),
        },
      });

      console.log(`✅ Order ${order.orderNumber} marked as PAID`);

      // Generate vouchers
      const vouchers = [];
      for (let i = 0; i < order.quantity; i++) {
        let voucherCode = '';
        let isUnique = false;
        while (!isUnique) {
          voucherCode = generateVoucherCode(8);
          const existing = await prisma.hotspotVoucher.findUnique({
            where: { code: voucherCode },
          });
          if (!existing) isUnique = true;
        }

        const voucher = await prisma.hotspotVoucher.create({
          data: {
            id: crypto.randomUUID(),
            code: voucherCode,
            batchCode: order.orderNumber,
            profileId: order.profileId,
            orderId: order.id,
            status: 'WAITING',
          },
        });

        vouchers.push(voucher);

        try {
          await syncVoucherToRadius(voucher.id);
          console.log(`✅ Voucher ${voucherCode} synced to RADIUS`);
        } catch (radiusError) {
          console.error(`RADIUS sync error for ${voucherCode}:`, radiusError);
        }
      }

      console.log(`✅ Generated ${vouchers.length} vouchers for order ${order.orderNumber}`);

      // Sync to Keuangan
      try {
        const hotspotCategory = await prisma.transactionCategory.findFirst({
          where: { name: 'Pembayaran Hotspot', type: 'INCOME' },
        });

        if (hotspotCategory) {
          const existingTransaction = await prisma.transaction.findFirst({
            where: { reference: order.orderNumber },
          });

          if (!existingTransaction) {
            await prisma.transaction.create({
              data: {
                id: nanoid(),
                categoryId: hotspotCategory.id,
                type: 'INCOME',
                amount: order.totalAmount,
                description: `Voucher ${order.profile.name} (${order.quantity}x) - ${order.customerName}`,
                date: paidAt || new Date(),
                reference: order.orderNumber,
                notes: `Auto-synced from voucher order payment via ${gateway}`,
              },
            });
            console.log(`✅ Transaction synced to Keuangan: ${order.orderNumber}`);
          }
        }
      } catch (keuanganError) {
        console.error('Keuangan sync error:', keuanganError);
      }

      // Send WhatsApp notification
      try {
        await sendVoucherPurchaseSuccess({
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          orderNumber: order.orderNumber,
          profileName: order.profile.name,
          quantity: order.quantity,
          voucherCodes: vouchers.map((v) => v.code),
          validityValue: order.profile.validityValue,
          validityUnit: order.profile.validityUnit,
        });
        console.log(`✅ WhatsApp voucher notification sent to ${order.customerPhone}`);
      } catch (waError) {
        console.error('WhatsApp voucher notification error:', waError);
      }
    }
  }
}

function generateVoucherCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// HANDLE INVOICE PAYMENT (PPPoE)
// ============================================
async function handleInvoicePayment(
  orderId: string,
  status: string,
  gateway: string,
  paymentType: string,
  paidAt: Date | null
) {
  // Find invoice by gatewayOrderId
  let invoice = await prisma.invoice.findFirst({
    where: { paymentToken: orderId },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });

  if (!invoice) {
    // Fallback: parse invoiceNumber
    const parts = orderId.split('-');
    if (parts.length >= 3 && parts[0] === 'INV') {
      const invoiceNumber = parts.slice(1, -1).join('-');
      invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber },
        include: {
          user: {
            include: { profile: true },
          },
        },
      });
    }
  }

  if (!invoice) {
    console.error('Invoice not found for orderId:', orderId);
    return;
  }

  console.log(`✅ Invoice found: ${invoice.invoiceNumber}`);

  if (status === 'settlement' || status === 'capture') {
    if (invoice.status !== 'PAID') {
      // Mark invoice as paid
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: paidAt || new Date(),
        },
      });

      // Create payment record if not exists
      const existingPayment = await prisma.payment.findFirst({
        where: { invoiceId: invoice.id },
      });

      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            id: crypto.randomUUID(),
            invoiceId: invoice.id,
            amount: invoice.amount,
            method: `${gateway}_${paymentType}`,
            status: 'completed',
            paidAt: paidAt || new Date(),
          },
        });
        console.log(`✅ Payment record created for invoice ${invoice.invoiceNumber}`);
      } else {
        console.log(`⚠️ Payment already exists for invoice ${invoice.invoiceNumber}, skipping duplicate`);
      }

      console.log(`✅ Invoice ${invoice.invoiceNumber} marked as PAID`);

      // Sync to Keuangan
      try {
        const pppoeCategory = await prisma.transactionCategory.findFirst({
          where: { name: 'Pembayaran PPPoE', type: 'INCOME' },
        });

        if (pppoeCategory) {
          const user = invoice.user;
          const existingTransaction = await prisma.transaction.findFirst({
            where: { reference: `INV-${invoice.invoiceNumber}` },
          });

          if (!existingTransaction) {
            const customerName = invoice.customerName || user?.name || 'Unknown';
            const profileName = user?.profile?.name || 'Unknown';

            await prisma.$executeRaw`
              INSERT INTO transactions (id, categoryId, type, amount, description, date, reference, notes, createdAt, updatedAt)
              VALUES (${nanoid()}, ${pppoeCategory.id}, 'INCOME', ${invoice.amount}, 
                      ${`Pembayaran ${profileName} - ${customerName}`}, NOW(), 
                      ${`INV-${invoice.invoiceNumber}`}, 
                      ${`Payment via ${gateway} (${paymentType})`}, NOW(), NOW())
            `;
            console.log(`✅ Transaction synced to Keuangan: ${invoice.invoiceNumber} (${formatCurrency(invoice.amount)})`);
          } else {
            console.log(`⏭️  Transaction already exists for: ${invoice.invoiceNumber}`);
          }
        }
      } catch (keuanganError) {
        console.error('Keuangan sync error:', keuanganError);
      }

      // Extend user expiry and activate if needed
      const user = invoice.user;
      if (user && user.profile) {
        const profile = user.profile;
        const now = new Date();
        let baseDate = user.expiredAt ? new Date(user.expiredAt) : now;
        if (baseDate < now) baseDate = now;

        let newExpiredAt = new Date(baseDate);
        switch (profile.validityUnit) {
          case 'DAYS':
            newExpiredAt.setDate(newExpiredAt.getDate() + profile.validityValue);
            break;
          case 'MONTHS':
            newExpiredAt.setMonth(newExpiredAt.getMonth() + profile.validityValue);
            break;
          case 'HOURS':
            newExpiredAt.setHours(newExpiredAt.getHours() + profile.validityValue);
            break;
          case 'MINUTES':
            newExpiredAt.setMinutes(newExpiredAt.getMinutes() + profile.validityValue);
            break;
        }

        const wasIsolatedOrSuspended = user.status === 'isolated' || user.status === 'suspended';
        const newStatus = wasIsolatedOrSuspended ? 'active' : user.status;

        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: {
            expiredAt: newExpiredAt,
            status: newStatus,
          },
        });

        console.log(`✅ User ${user.username} updated:`);
        console.log(`   - Expiry: ${user.expiredAt?.toISOString() || 'N/A'} → ${newExpiredAt.toISOString()}`);

        // Send WhatsApp notification
        try {
          await sendPaymentSuccess({
            customerName: user.name,
            customerPhone: user.phone,
            username: user.username,
            password: user.password,
            profileName: profile.name,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
          });
          console.log(`✅ WhatsApp payment success notification sent`);
        } catch (waError) {
          console.error('WhatsApp notification error:', waError);
        }

        // Reactivate if was isolated/suspended
        if (wasIsolatedOrSuspended) {
          console.log(`   - Status: ${user.status} → ${newStatus}`);

          try {
            // RADIUS restore
            await prisma.$executeRaw`
              INSERT INTO radcheck (username, attribute, op, value)
              VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
              ON DUPLICATE KEY UPDATE value = ${user.password}
            `;

            await prisma.$executeRaw`
              INSERT INTO radusergroup (username, groupname, priority)
              VALUES (${user.username}, ${profile.groupName}, 0)
              ON DUPLICATE KEY UPDATE groupname = ${profile.groupName}
            `;

            await prisma.radreply.deleteMany({
              where: {
                username: user.username,
                attribute: 'Reply-Message',
              },
            });

            if (user.ipAddress) {
              await prisma.$executeRaw`
                INSERT INTO radreply (username, attribute, op, value)
                VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
                ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
              `;
            }

            console.log(`✅ RADIUS entries restored for ${user.username}`);

            // Update registration if exists
            const registration = await prisma.registrationRequest.findFirst({
              where: {
                pppoeUserId: user.id,
                status: 'INSTALLED',
              },
            });

            if (registration) {
              await prisma.registrationRequest.update({
                where: { id: registration.id },
                data: { status: 'ACTIVE' },
              });
              console.log(`✅ Registration ${registration.id} status updated to ACTIVE`);
            }

            // CoA disconnect
            if (user.routerId) {
              const company = await prisma.company.findFirst();
              const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL;
              if (baseUrl) {
                try {
                  const coaRes = await fetch(`${baseUrl}/api/coa/disconnect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user.username }),
                  });
                  if (coaRes.ok) {
                    console.log(`✅ CoA disconnect sent for ${user.username}`);
                  }
                } catch (coaError) {
                  console.error('CoA disconnect failed:', coaError);
                }
              }
            }
          } catch (radiusError) {
            console.error('RADIUS sync error:', radiusError);
          }
        }
      }
    }
  }
}