import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WhatsAppService } from '@/lib/whatsapp';
import { toNairobi, nowNairobi } from '@/lib/timezone';
import crypto from 'crypto';

// Disable caching
export const dynamic = 'force-dynamic';

// Local type definitions (avoids dependency on Prisma generated types)
interface AgentRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfileRow {
  id: string;
  name: string;
  costPrice: number;
  resellerFee: number;
  sellingPrice: number;
}

interface VoucherWithProfile {
  id: string;
  code: string;
  batchCode: string | null;
  status: string;
  firstLoginAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  profile: ProfileRow | null;
}

// GET - List all agents with statistics (calculated from vouchers)
export async function GET() {
  try {
    const agents = (await prisma.agent.findMany({
      orderBy: { createdAt: 'desc' },
    })) as unknown as AgentRow[];

    // Get all used vouchers once, then group by agent
    const allVouchers = (await prisma.hotspotVoucher.findMany({
      where: {
        batchCode: { not: null },
        firstLoginAt: { not: null },
        status: { in: ['ACTIVE', 'EXPIRED'] },
      },
      include: {
        profile: true,
      },
    })) as unknown as VoucherWithProfile[];

    const now = nowNairobi();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const agentsWithStats = agents.map((agent: AgentRow) => {
      // Match vouchers by batch code pattern (agent name normalized)
      const agentPattern = agent.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const agentVouchers = allVouchers.filter((v) =>
        v.batchCode?.toUpperCase().startsWith(agentPattern)
      );

      // Current month vouchers
      const currentMonthVouchers = agentVouchers.filter(
        (v: VoucherWithProfile) => {
          const saleDate = toNairobi(v.firstLoginAt!);
          if (!saleDate) return false;
          return (
            saleDate.getMonth() === currentMonth &&
            saleDate.getFullYear() === currentYear
          );
        }
      );

      // Commission = resellerFee per voucher (agent's profit)
      const currentMonthCommission = currentMonthVouchers.reduce(
        (sum: number, v: VoucherWithProfile) =>
          sum + (v.profile?.resellerFee || 0),
        0
      );
      const totalCommission = agentVouchers.reduce(
        (sum: number, v: VoucherWithProfile) =>
          sum + (v.profile?.resellerFee || 0),
        0
      );

      // Owed = costPrice per voucher (what agent pays admin)
      const currentMonthOwed = currentMonthVouchers.reduce(
        (sum: number, v: VoucherWithProfile) =>
          sum + (v.profile?.costPrice || 0),
        0
      );
      const totalOwed = agentVouchers.reduce(
        (sum: number, v: VoucherWithProfile) =>
          sum + (v.profile?.costPrice || 0),
        0
      );

      return {
        id: agent.id,
        name: agent.name,
        phone: agent.phone,
        email: agent.email,
        address: agent.address,
        isActive: agent.isActive,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        stats: {
          currentMonth: {
            total: currentMonthCommission,
            count: currentMonthVouchers.length,
            owed: currentMonthOwed,
          },
          allTime: {
            total: totalCommission,
            count: agentVouchers.length,
            owed: totalOwed,
          },
        },
      };
    });

    return NextResponse.json({ agents: agentsWithStats });
  } catch (error) {
    console.error('Get agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, address } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.agent.findUnique({
      where: { phone },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.create({
      data: {
        id: crypto.randomUUID(),
        name,
        phone,
        email: email || null,
        address: address || null,
      },
    });

    // Send WhatsApp notification
    try {
      const company = await prisma.company.findFirst();
      const baseUrl =
        company?.baseUrl ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3000';
      const agentPortalUrl = `${baseUrl}/agent`;
      const companyName = company?.name || 'SKYLINK';
      const companyPhone = company?.phone || '';

      const message =
        `🎉 *Welcome to join as an agent!*\n\n` +
        `Habari *${name}*,\n\n` +
        `You have registered as an agent ${companyName}. ` +
        `Now you can sell internet vouchers and earn commission!\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📱 *Access Agent Portal:*\n` +
        `${agentPortalUrl}\n\n` +
        `🔐 *Login with:*\n` +
        `Phone NO: *${phone}*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `✨ *Agent Portal feature:*\n` +
        `• Generate wifi voucher\n` +
        `• View sales history\n` +
        `• Monitor commissions\n` +
        `• Download voucher in PDF format\n\n` +
        `💰 *Commission Info:*\n` +
        `You will get a commission from every voucher sold. ` +
        `Commissions will be automatically recorded on your dashboard.\n\n` +
        `📞 Need help? Get in touch: ${companyPhone}\n\n` +
        `Happy selling! 🚀\n${companyName}`;

      await WhatsAppService.sendMessage({
        phone: phone,
        message,
      });
    } catch (waError) {
      console.error('[Agent] Failed to send WhatsApp:', waError);
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Create agent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update agent
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, phone, email, address, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    const existing = await prisma.agent.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (phone && phone !== existing.phone) {
      const phoneExists = await prisma.agent.findUnique({
        where: { phone },
      });

      if (phoneExists) {
        return NextResponse.json(
          { error: 'Phone number already exists' },
          { status: 400 }
        );
      }
    }

    const agent = await prisma.agent.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Update agent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove agent
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    await prisma.agent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete agent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}