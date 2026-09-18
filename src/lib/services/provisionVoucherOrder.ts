// src/lib/services/provisionVoucherOrder.ts
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { syncBatchToRadius } from '@/lib/hotspot-radius-sync';
import { authorizeChilliUser } from '@/lib/services/chilliService';
import smsService from '@/lib/services/sms';

export interface ProvisionResult {
  success: boolean;
  alreadyProvisioned: boolean;
  voucherCodes: string[];
  authorized: boolean;
  error?: string;
}

function generateVoucherCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function provisionVoucherOrder(
  orderId: string
): Promise<ProvisionResult> {
  const order = await prisma.voucherOrder.findUnique({
    where: { id: orderId },
    include: { profile: true },
  });

  if (!order) {
    return {
      success: false,
      alreadyProvisioned: false,
      voucherCodes: [],
      authorized: false,
      error: 'Order not found',
    };
  }

  if (order.status !== 'PAID') {
    return {
      success: false,
      alreadyProvisioned: false,
      voucherCodes: [],
      authorized: false,
      error: `Order status is ${order.status}`,
    };
  }

  // Already provisioned?
  const existing = await prisma.hotspotVoucher.findMany({
    where: { orderId: order.id },
    select: { code: true },
  });
  if (existing.length > 0) {
    return {
      success: true,
      alreadyProvisioned: true,
      voucherCodes: existing.map((v) => v.code),
      authorized: false,
    };
  }

  // Atomic claim
  const claim = await prisma.voucherOrder.updateMany({
    where: { id: order.id, provisionedAt: null },
    data: { provisionedAt: new Date() },
  });

  if (claim.count === 0) {
    const current = await prisma.hotspotVoucher.findMany({
      where: { orderId: order.id },
      select: { code: true },
    });
    return {
      success: true,
      alreadyProvisioned: true,
      voucherCodes: current.map((v) => v.code),
      authorized: false,
    };
  }

  // Agent sale path
  if (order.agentId && order.linkedVoucherId) {
    return await provisionAgentSale({
      id: order.id,
      orderNumber: order.orderNumber,
      linkedVoucherId: order.linkedVoucherId,
      agentId: order.agentId,
      customerPhone: order.customerPhone,
      profileId: order.profileId,
      clientIp: order.clientIp,
      clientMac: order.clientMac,
    });
  }

  // Direct purchase path
  return await provisionDirectSale({
    id: order.id,
    orderNumber: order.orderNumber,
    quantity: order.quantity,
    profileId: order.profileId,
    customerPhone: order.customerPhone,
    clientIp: order.clientIp,
    clientMac: order.clientMac,
  });
}

interface DirectOrder {
  id: string;
  orderNumber: string;
  quantity: number;
  profileId: string;
  customerPhone: string;
  clientIp: string | null;
  clientMac: string | null;
}

async function provisionDirectSale(order: DirectOrder): Promise<ProvisionResult> {
  const batchCode = `ORDER-${order.orderNumber}`;
  const codes: string[] = [];

  for (let i = 0; i < order.quantity; i++) {
    const code = generateVoucherCode();
    await prisma.hotspotVoucher.create({
      data: {
        id: crypto.randomUUID(),
        code,
        profileId: order.profileId,
        batchCode,
        orderId: order.id,
        status: 'WAITING',
      },
    });
    codes.push(code);
  }

  void postProvision({
    orderId: order.id,
    orderNumber: order.orderNumber,
    batchCode,
    codes,
    customerPhone: order.customerPhone,
    clientIp: order.clientIp,
    clientMac: order.clientMac,
  });

  return {
    success: true,
    alreadyProvisioned: false,
    voucherCodes: codes,
    authorized: false,
  };
}

interface AgentOrder {
  id: string;
  orderNumber: string;
  linkedVoucherId: string;
  agentId: string;
  customerPhone: string;
  profileId: string;
  clientIp: string | null;
  clientMac: string | null;
}

async function provisionAgentSale(order: AgentOrder): Promise<ProvisionResult> {
  const voucher = await prisma.hotspotVoucher.findUnique({
    where: { id: order.linkedVoucherId },
    include: { profile: true },
  });

  if (!voucher) {
    return {
      success: false,
      alreadyProvisioned: false,
      voucherCodes: [],
      authorized: false,
      error: 'Linked voucher not found',
    };
  }

  await prisma.hotspotVoucher.update({
    where: { id: voucher.id },
    data: {
      orderId: order.id,
      soldAt: new Date(),
      soldToPhone: order.customerPhone,
    },
  });

  const existingSale = await prisma.agentSale.findFirst({
    where: { voucherCode: voucher.code },
  });
  if (!existingSale) {
    await prisma.agentSale.create({
      data: {
        id: crypto.randomUUID(),
        agentId: order.agentId,
        voucherCode: voucher.code,
        profileName: voucher.profile.name,
        amount: voucher.profile.resellerFee,
        createdAt: new Date(),
      },
    });
  }

  void postProvision({
    orderId: order.id,
    orderNumber: order.orderNumber,
    batchCode: voucher.batchCode || `ORDER-${order.orderNumber}`,
    codes: [voucher.code],
    customerPhone: order.customerPhone,
    clientIp: order.clientIp,
    clientMac: order.clientMac,
  });

  return {
    success: true,
    alreadyProvisioned: false,
    voucherCodes: [voucher.code],
    authorized: false,
  };
}

interface SideEffectArgs {
  orderId: string;
  orderNumber: string;
  batchCode: string;
  codes: string[];
  customerPhone: string;
  clientIp: string | null;
  clientMac: string | null;
}

async function postProvision(args: SideEffectArgs): Promise<void> {
  try {
    const r = await syncBatchToRadius(args.batchCode);
    console.log(`[Provision] RADIUS sync ${args.batchCode}: ${r.successCount}/${r.total}`);
  } catch (e) {
    console.error('[Provision] RADIUS sync failed:', e);
  }

  if (args.clientIp && args.clientMac && args.codes.length > 0) {
    try {
      const a = await authorizeChilliUser({
        ip: args.clientIp,
        mac: args.clientMac,
        username: args.codes[0],
        sessionTimeout: 86400,
      });
      console.log(
        `[Provision] Chilli auth ${args.codes[0]}:`,
        a.success ? 'OK' : a.error
      );
    } catch (e) {
      console.error('[Provision] Chilli auth failed:', e);
    }
  }

  if (args.customerPhone && args.codes.length > 0) {
    try {
      const first = args.codes[0];
      const extra = args.codes.length > 1 ? ` (+${args.codes.length - 1} more)` : '';
      await smsService.sendSMS(
        args.customerPhone,
        `Your WiFi voucher is ready!\nCode: ${first}${extra}\nOrder: ${args.orderNumber}\nConnect to WiFi and enter the code. - SKYLINK`
      );
    } catch (e) {
      console.error('[Provision] SMS failed:', e);
    }
  }
}