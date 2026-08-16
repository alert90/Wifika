import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

interface ProcessedSession {
  id: string;
  username: string;
  sessionId: string;
  type: 'pppoe' | 'hotspot';
  nasIpAddress: string | null;
  framedIpAddress: string | null;
  macAddress: string | null;
  startTime: Date | null;
  duration: number;
  durationFormatted: string;
  uploadBytes: number;
  downloadBytes: number;
  totalBytes: number;
  uploadFormatted: string;
  downloadFormatted: string;
  totalFormatted: string;
  router: { id: string; name: string } | null;
  user: { id: string; name: string | null; phone: string | null; profile: string | undefined } | null;
  voucher: { id: string; status: string; profile: string | undefined } | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const routerId = searchParams.get('routerId');
    const search = searchParams.get('search');

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: Prisma.radacctWhereInput = {
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
    };

    const andConditions = where.AND as Prisma.radacctWhereInput[];

    if (search) {
      andConditions.push({
        OR: [
          { username: { contains: search } },
          { framedipaddress: { contains: search } },
        ],
      });
    }

    if (routerId) {
      const router = await prisma.router.findUnique({
        where: { id: routerId },
        select: { nasname: true },
      });
      if (router) {
        andConditions.push({ nasipaddress: router.nasname });
      }
    }

    const radacctSessions = await prisma.radacct.findMany({
      where,
      orderBy: { acctstarttime: 'desc' },
    });

    const sessions = await Promise.all(
      radacctSessions.map(async (session): Promise<ProcessedSession | null> => {
        const username = session.username;
        
        const pppoeUser = await prisma.pppoeUser.findUnique({
          where: { username },
          select: { id: true },
        });
        const sessionType: 'pppoe' | 'hotspot' = pppoeUser ? 'pppoe' : 'hotspot';
        
        if (type && type !== sessionType) {
          return null;
        }

        const startTime = session.acctstarttime ? new Date(session.acctstarttime) : new Date();
        const durationSeconds = session.acctsessiontime || Math.floor((Date.now() - startTime.getTime()) / 1000);
        
        const uploadBytes = Number(session.acctinputoctets || 0);
        const downloadBytes = Number(session.acctoutputoctets || 0);
        const totalBytes = uploadBytes + downloadBytes;

        const router = await prisma.router.findFirst({
          where: { nasname: session.nasipaddress },
          select: { id: true, name: true },
        });

        if (sessionType === 'pppoe') {
          const userInfo = await prisma.pppoeUser.findUnique({
            where: { username },
            select: {
              id: true,
              name: true,
              phone: true,
              profile: {
                select: { name: true },
              },
            },
          });

          return {
            id: session.radacctid.toString(),
            username: session.username,
            sessionId: session.acctsessionid,
            type: sessionType,
            nasIpAddress: session.nasipaddress,
            framedIpAddress: session.framedipaddress,
            macAddress: session.callingstationid,
            startTime: session.acctstarttime,
            duration: durationSeconds,
            durationFormatted: formatDuration(durationSeconds),
            uploadBytes,
            downloadBytes,
            totalBytes,
            uploadFormatted: formatBytes(uploadBytes),
            downloadFormatted: formatBytes(downloadBytes),
            totalFormatted: formatBytes(totalBytes),
            router: router ? { id: router.id, name: router.name } : null,
            user: userInfo ? {
              id: userInfo.id,
              name: userInfo.name,
              phone: userInfo.phone,
              profile: userInfo.profile?.name,
            } : null,
            voucher: null,
          };
        } else {
          const voucherInfo = await prisma.hotspotVoucher.findUnique({
            where: { code: username },
            select: {
              id: true,
              status: true,
              profile: {
                select: { name: true },
              },
            },
          });

          return {
            id: session.radacctid.toString(),
            username: session.username,
            sessionId: session.acctsessionid,
            type: sessionType,
            nasIpAddress: session.nasipaddress,
            framedIpAddress: session.framedipaddress,
            macAddress: session.callingstationid,
            startTime: session.acctstarttime,
            duration: durationSeconds,
            durationFormatted: formatDuration(durationSeconds),
            uploadBytes,
            downloadBytes,
            totalBytes,
            uploadFormatted: formatBytes(uploadBytes),
            downloadFormatted: formatBytes(downloadBytes),
            totalFormatted: formatBytes(totalBytes),
            router: router ? { id: router.id, name: router.name } : null,
            user: null,
            voucher: voucherInfo ? {
              id: voucherInfo.id,
              status: voucherInfo.status,
              profile: voucherInfo.profile?.name,
            } : null,
          };
        }
      })
    );

    const filteredSessions = sessions.filter((s): s is ProcessedSession => s !== null);

    const stats = {
      total: filteredSessions.length,
      pppoe: filteredSessions.filter(s => s.type === 'pppoe').length,
      hotspot: filteredSessions.filter(s => s.type === 'hotspot').length,
      totalBandwidth: filteredSessions.reduce((sum, s) => sum + s.totalBytes, 0),
    };

    const allTimeStats = await prisma.radacct.aggregate({
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
        acctsessiontime: true,
      },
      _count: {
        radacctid: true,
      },
    });

    const totalAllTimeBytes = 
      (Number(allTimeStats._sum.acctinputoctets) || 0) + 
      (Number(allTimeStats._sum.acctoutputoctets) || 0);

    return NextResponse.json({
      sessions: filteredSessions,
      stats: {
        ...stats,
        totalBandwidthFormatted: formatBytes(stats.totalBandwidth),
      },
      allTimeStats: {
        totalSessions: allTimeStats._count.radacctid || 0,
        totalBandwidth: totalAllTimeBytes,
        totalBandwidthFormatted: formatBytes(totalAllTimeBytes),
        totalDuration: allTimeStats._sum.acctsessiontime || 0,
        totalDurationFormatted: formatDuration(allTimeStats._sum.acctsessiontime || 0),
      },
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}