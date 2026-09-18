import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * POST /api/agent/record-sales
 * Record agent sales for vouchers that became ACTIVE or EXPIRED
 * Should be called by cron job or after voucher activation
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(request: NextRequest) {
  try {
    // 1. Fetch all agents to create a case-insensitive mapping of Name -> ID
    const allAgents = await prisma.agent.findMany();
    const agentMap = new Map<string, string>();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allAgents.forEach((a: any) => {
      // Normalize the name: uppercase and remove special characters
      const normalizedName = a.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      agentMap.set(normalizedName, a.id);
    });

    // 2. Fetch all vouchers that have been used (firstLoginAt is not null)
    // This includes both ACTIVE and EXPIRED vouchers, preventing missed sales
    const soldVouchers = await prisma.hotspotVoucher.findMany({
      where: {
        batchCode: { not: null },
        firstLoginAt: { not: null },
        status: { in: ['ACTIVE', 'EXPIRED'] }, // CRITICAL FIX: Include EXPIRED
      },
      include: {
        profile: true,
      },
    });

    let recordedCount = 0;
    const errors = [];

    for (const voucher of soldVouchers) {
      if (!voucher.batchCode) continue;

      // Extract agent name pattern from batch code (e.g., "ASLAM-123456" -> "ASLAM")
      const rawAgentName = voucher.batchCode.split('-')[0];
      const normalizedBatchName = rawAgentName.toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Find agent ID using the map (fixes case-sensitivity issue)
      const agentId = agentMap.get(normalizedBatchName);

      if (!agentId) {
        errors.push({
          voucher: voucher.code,
          error: `Agent not found for batch: ${voucher.batchCode}`,
        });
        continue;
      }

      // Check if sale already recorded
      const existingSale = await prisma.agentSale.findFirst({
        where: {
          voucherCode: voucher.code,
        },
      });

      if (existingSale) {
        continue; // Already recorded
      }

      try {
        // Record sale with resellerFee as agent profit
        await prisma.agentSale.create({
          data: {
            id: crypto.randomUUID(),
            agentId: agentId,
            voucherCode: voucher.code,
            profileName: voucher.profile.name,
            amount: voucher.profile.resellerFee, // Agent earns resellerFee
            createdAt: voucher.firstLoginAt!, // Use first login time as sale time
          },
        });

        recordedCount++;
      } catch (error: unknown) {
        // FIX: Handle unknown error type instead of 'any'
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          voucher: voucher.code,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      recorded: recordedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Recorded ${recordedCount} agent sales`,
    });
  } catch (error) {
    console.error('Record agent sales error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}