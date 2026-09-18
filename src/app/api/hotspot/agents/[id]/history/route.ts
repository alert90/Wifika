import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toNairobi } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

// Local type definitions (avoids dependency on Prisma generated types)
interface AgentRow {
  id: string;
  name: string;
}

interface ProfileRow {
  id: string;
  name: string;
  costPrice: number;
  resellerFee: number;
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

interface SaleLike {
  id: string;
  voucherCode: string;
  profileName: string;
  amount: number;
  costPrice: number;
  createdAt: string;
}

// GET - Get agent sales history grouped by month (calculated from vouchers)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // Get agent first to get name for batch pattern matching
    const agent = (await prisma.agent.findUnique({
      where: { id },
      select: { id: true, name: true },
    })) as unknown as AgentRow | null;

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get all used vouchers for this agent
    const agentPattern = agent.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const allVouchers = (await prisma.hotspotVoucher.findMany({
      where: {
        batchCode: {
          startsWith: agentPattern,
        },
        firstLoginAt: { not: null },
        status: { in: ['ACTIVE', 'EXPIRED'] },
      },
      include: {
        profile: true,
      },
      orderBy: {
        firstLoginAt: 'desc',
      },
    })) as unknown as VoucherWithProfile[];

    // Map vouchers to sale-like objects
    const sales: SaleLike[] = allVouchers.map((v: VoucherWithProfile) => ({
      id: v.id,
      voucherCode: v.code,
      profileName: v.profile?.name || 'Unknown',
      amount: v.profile?.resellerFee || 0, // commission
      costPrice: v.profile?.costPrice || 0, // what agent owes
      createdAt: v.firstLoginAt!.toISOString(),
    }));

    // If specific month is requested, filter
    if (month && year) {
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      const monthSales = sales.filter((sale: SaleLike) => {
        const saleDate = toNairobi(new Date(sale.createdAt));
        if (!saleDate) return false;
        return (
          saleDate.getMonth() === monthNum &&
          saleDate.getFullYear() === yearNum
        );
      });

      const total = monthSales.reduce(
        (sum: number, sale: SaleLike) => sum + sale.amount,
        0
      );
      const totalOwed = monthSales.reduce(
        (sum: number, sale: SaleLike) => sum + sale.costPrice,
        0
      );

      return NextResponse.json({
        month: monthNum,
        year: yearNum,
        total, // commission
        totalOwed, // what agent owes admin
        count: monthSales.length,
        sales: monthSales,
      });
    }

    // Group sales by month
    const groupedByMonth: Record<string, SaleLike[]> = {};

    sales.forEach((sale: SaleLike) => {
      const saleDate = toNairobi(new Date(sale.createdAt));
      if (!saleDate) return;

      const key = `${saleDate.getFullYear()}-${String(
        saleDate.getMonth() + 1
      ).padStart(2, '0')}`;

      if (!groupedByMonth[key]) {
        groupedByMonth[key] = [];
      }
      groupedByMonth[key].push(sale);
    });

    // Calculate totals for each month
    const monthlyStats = Object.entries(groupedByMonth).map(
      ([key, monthSales]: [string, SaleLike[]]) => {
        const [yearStr, monthStr] = key.split('-');
        const total = monthSales.reduce(
          (sum: number, sale: SaleLike) => sum + sale.amount,
          0
        );
        const totalOwed = monthSales.reduce(
          (sum: number, sale: SaleLike) => sum + sale.costPrice,
          0
        );

        return {
          year: parseInt(yearStr),
          month: parseInt(monthStr),
          monthName: new Date(
            parseInt(yearStr),
            parseInt(monthStr) - 1
          ).toLocaleString('en-US', {
            month: 'long',
            year: 'numeric',
          }),
          total, // commission
          totalOwed, // what agent owes
          count: monthSales.length,
        };
      }
    );

    // Sort by year and month descending
    monthlyStats.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    return NextResponse.json({
      history: monthlyStats,
    });
  } catch (error) {
    console.error('Get agent history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}