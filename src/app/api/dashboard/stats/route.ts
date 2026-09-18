import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nowNairobi, startOfDayNairobiToUTC, endOfDayNairobiToUTC } from "@/lib/timezone";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Disable caching for this route - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Local type helpers (avoids dependency on Prisma generated types)
interface VoucherWithProfile {
  id: string;
  code: string;
  batchCode: string | null;
  status: string;
  firstLoginAt: Date | null;
  profile: {
    name: string;
    costPrice: number;
    resellerFee: number;
    sellingPrice: number;
  } | null;
}

interface AgentNameOnly {
  name: string;
}

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    console.log('Dashboard stats accessed by role:', userRole);

    const now = nowNairobi();

    const startOfMonth = startOfDayNairobiToUTC(new Date(now.getFullYear(), now.getMonth(), 1));
    const startOfLastMonth = startOfDayNairobiToUTC(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const endOfLastMonth = endOfDayNairobiToUTC(new Date(now.getFullYear(), now.getMonth(), 0));
    const startOfToday = startOfDayNairobiToUTC(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

    // ========== EXISTING STATS ==========
    const totalUsers = await prisma.pppoeUser.count();
    const lastMonthUsers = await prisma.pppoeUser.count({
      where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    });
    const usersGrowth = lastMonthUsers > 0
      ? ((totalUsers - lastMonthUsers) / lastMonthUsers) * 100
      : 0;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeSessions = await prisma.radacct.count({
      where: {
        AND: [
          { acctstoptime: null },
          {
            OR: [
              { acctupdatetime: { gte: tenMinutesAgo } },
              {
                AND: [
                  { acctupdatetime: null },
                  { acctstarttime: { gte: oneDayAgo } },
                ],
              },
            ],
          },
        ],
      },
    });

    const pendingInvoices = await prisma.invoice.count({
      where: { status: "PENDING" },
    });

    const lastMonthPendingInvoices = await prisma.invoice.count({
      where: {
        status: "PENDING",
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    });
    const invoicesChange = lastMonthPendingInvoices > 0
      ? ((pendingInvoices - lastMonthPendingInvoices) / lastMonthPendingInvoices) * 100
      : 0;

    // Revenue this month from transactions
    const incomeThisMonth = await prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        date: { gte: startOfMonth, lte: now },
      },
      _sum: { amount: true },
    });

    const incomeLastMonth = await prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        date: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { amount: true },
    });

    // All-time transaction income
    const incomeAllTime = await prisma.transaction.aggregate({
      where: { type: 'INCOME' },
      _sum: { amount: true },
    });

    const revenueThisMonth = Number(incomeThisMonth._sum.amount) || 0;
    const revenueLastMonth = Number(incomeLastMonth._sum.amount) || 0;
    const revenueAllTime = Number(incomeAllTime._sum.amount) || 0;
    const revenueGrowth = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : 0;

    const formatRevenue = (amount: number) => {
      return new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency: "TZS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const pppoeActiveCount = await prisma.pppoeUser.count({
      where: { status: "active" },
    });

    const hotspotActiveCount = await prisma.hotspotVoucher.count({
      where: { status: "ACTIVE" },
    });

    const bandwidthData = await prisma.radacct.aggregate({
      _sum: { acctinputoctets: true, acctoutputoctets: true },
    });

    const totalBytesIn = bandwidthData._sum.acctinputoctets || BigInt(0);
    const totalBytesOut = bandwidthData._sum.acctoutputoctets || BigInt(0);
    const totalBytes = Number(totalBytesIn) + Number(totalBytesOut);

    const formatBandwidth = (bytes: number) => {
      const tb = bytes / 1024 ** 4;
      const gb = bytes / 1024 ** 3;
      if (tb >= 1) return `${tb.toFixed(2)} TB`;
      if (gb >= 1) return `${gb.toFixed(2)} GB`;
      return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    };

    // ========== NEW: AGENT + VOUCHER SALES + REVENUE BREAKDOWN ==========

    // 1. Agent counts
    const totalAgents = await prisma.agent.count();
    const activeAgents = await prisma.agent.count({ where: { isActive: true } });

    // 2. Build set of agent name prefixes for categorizing vouchers
    const allAgentNames = (await prisma.agent.findMany({
      select: { name: true },
    })) as unknown as AgentNameOnly[];

    const agentPatterns = new Set(
      allAgentNames.map((a) =>
        a.name.toUpperCase().replace(/[^A-Z0-9]/g, '')
      )
    );

    // 3. Get all used vouchers (sold = has firstLoginAt + ACTIVE/EXPIRED)
    const usedVouchers = (await prisma.hotspotVoucher.findMany({
      where: {
        firstLoginAt: { not: null },
        status: { in: ['ACTIVE', 'EXPIRED'] },
      },
      include: { profile: true },
    })) as unknown as VoucherWithProfile[];

    // 4. Categorize vouchers + compute totals
    let agentVouchersCount = 0;
    let directVouchersCount = 0;
    let grossOwed = 0;          // sum of costPrice for agent vouchers
    let directSalesTotal = 0;   // sum of sellingPrice for direct vouchers
    let currentMonthVouchersCount = 0;
    let todayVouchersCount = 0;

    for (const v of usedVouchers) {
      const firstLoginAt = v.firstLoginAt as Date;

      if (firstLoginAt >= startOfToday) todayVouchersCount++;
      if (firstLoginAt >= startOfMonth) currentMonthVouchersCount++;

      const prefix = (v.batchCode || '').toUpperCase().split('-')[0];
      const isAgentVoucher = prefix && agentPatterns.has(prefix);

      if (isAgentVoucher) {
        agentVouchersCount++;
        grossOwed += v.profile?.costPrice || 0;
      } else {
        directVouchersCount++;
        directSalesTotal += v.profile?.sellingPrice || 0;
      }
    }

    // 5. Agent payments received (money agents already paid)
    const agentPaidAgg = await prisma.agentPayment.aggregate({
      where: { status: { in: ['PAID', 'SUCCESS'] } },
      _sum: { amount: true },
    });
    const agentPaid = Number(agentPaidAgg._sum.amount) || 0;

    // 6. Outstanding = gross owed - what's been paid (never negative)
    const agentOutstanding = Math.max(0, grossOwed - agentPaid);

    // 7. Total revenue (collected) = transaction income + agent payments + direct voucher sales
    const totalRevenueCollected = revenueAllTime + agentPaid + directSalesTotal;

    // ========== RECENT ACTIVITIES ==========
    const recentPayments = await prisma.payment.findMany({
      take: 3,
      orderBy: { paidAt: "desc" },
      include: {
        invoice: {
          select: {
            customerUsername: true,
            user: { select: { username: true } },
          },
        },
      },
    });

    const recentInvoices = await prisma.invoice.findMany({
      where: { status: "PENDING", dueDate: { lt: now } },
      take: 2,
      orderBy: { dueDate: "desc" },
      select: {
        customerUsername: true,
        dueDate: true,
        user: { select: { username: true } },
      },
    });

    type PaymentRow = {
      id: string;
      paidAt: Date;
      invoice: {
        customerUsername: string | null;
        user: { username: string } | null;
      };
    };

    type InvoiceRow = {
      customerUsername: string | null;
      dueDate: Date;
      user: { username: string } | null;
    };

    const activities = [
      ...(recentPayments as unknown as PaymentRow[]).map((payment: PaymentRow) => ({
        id: payment.id,
        user:
          payment.invoice.user?.username ||
          payment.invoice.customerUsername ||
          "Unknown",
        action: "Payment received",
        time: payment.paidAt.toISOString(),
        status: "success" as const,
      })),
      ...(recentInvoices as unknown as InvoiceRow[]).map((invoice: InvoiceRow) => ({
        id: invoice.customerUsername || "unknown",
        user: invoice.user?.username || invoice.customerUsername || "Unknown",
        action: "Invoice overdue",
        time: invoice.dueDate.toISOString(),
        status: "warning" as const,
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);

    // ========== SYSTEM STATUS ==========
    let radiusStatus = false;
    try {
      const recentRadacct = await prisma.radacct.findFirst({
        where: { acctstarttime: { gte: new Date(Date.now() - 3600000) } },
      });
      radiusStatus = !!recentRadacct;
    } catch {
      radiusStatus = false;
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: {
          value: totalUsers,
          change: `${usersGrowth > 0 ? "+" : ""}${usersGrowth.toFixed(1)}%`,
        },
        activeSessions: {
          value: activeSessions,
          change: null,
        },
        pendingInvoices: {
          value: pendingInvoices,
          change: `${invoicesChange > 0 ? "+" : ""}${invoicesChange.toFixed(1)}%`,
        },
        revenue: {
          value: formatRevenue(revenueThisMonth),
          change: `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`,
        },
      },
      network: {
        pppoeUsers: pppoeActiveCount,
        hotspotSessions: hotspotActiveCount,
        bandwidth: formatBandwidth(totalBytes),
      },
      // NEW: Agent + Sales overview
      agents: {
        total: totalAgents,
        active: activeAgents,
        grossOwed,             // total costPrice of used agent vouchers
        paid: agentPaid,       // amount agents already paid
        outstanding: agentOutstanding, // remaining balance owed
      },
      sales: {
        totalVouchers: usedVouchers.length,
        agentVouchers: agentVouchersCount,
        directVouchers: directVouchersCount,
        currentMonthVouchers: currentMonthVouchersCount,
        todayVouchers: todayVouchersCount,
      },
      // NEW: Revenue breakdown (all-time)
      revenueBreakdown: {
        transactionIncome: revenueAllTime,
        agentPaid,
        directVoucherSales: directSalesTotal,
        total: totalRevenueCollected,
      },
      activities,
      systemStatus: {
        radius: radiusStatus,
        database: true,
        api: true,
      },
    });
  } catch (error: unknown) {
    console.error("Dashboard stats error:", error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}