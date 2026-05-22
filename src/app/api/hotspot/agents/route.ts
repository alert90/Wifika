import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { WhatsAppService } from '@/lib/whatsapp';
import { toNairobi, nowNairobi } from '@/lib/timezone';

const prisma = new PrismaClient();

// GET - List all agents with statistics
export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        sales: {
          select: {
            amount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics for each agent
    const agentsWithStats = agents.map((agent) => {
      // Use WIB timezone for month calculation (UTC stored in DB)
      const now = nowNairobi();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Current month sales - Convert UTC to WIB before comparison
      const currentMonthSales = agent.sales.filter((sale) => {
        const saleDate = toNairobi(sale.createdAt);
        if (!saleDate) return false;
        return (
          saleDate.getMonth() === currentMonth &&
          saleDate.getFullYear() === currentYear
        );
      });

      const currentMonthTotal = currentMonthSales.reduce(
        (sum, sale) => sum + sale.amount,
        0
      );
      const currentMonthCount = currentMonthSales.length;

      // Total sales
      const totalSales = agent.sales.reduce((sum, sale) => sum + sale.amount, 0);
      const totalCount = agent.sales.length;

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
            total: currentMonthTotal,
            count: currentMonthCount,
          },
          allTime: {
            total: totalSales,
            count: totalCount,
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

    // Check if phone already exists
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

    // Send WhatsApp notification with agent portal link
    try {
      const company = await prisma.company.findFirst();
      const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const agentPortalUrl = `${baseUrl}/agent`;
      const companyName = company?.name || 'SKYLINK';
      const companyPhone = company?.phone || '';

      const message = `🎉 *Welcome to join as an agent!*\n\n` +
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
        message
      });

      console.log(`[Agent] WhatsApp sent to ${phone} with portal link`);
    } catch (waError) {
      console.error('[Agent] Failed to send WhatsApp:', waError);
      // Don't fail agent creation if WhatsApp fails
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

    // Check if agent exists
    const existing = await prisma.agent.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check if phone is being changed and if new phone already exists
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
