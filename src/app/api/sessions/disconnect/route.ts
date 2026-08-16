import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCoADisconnect } from '@/lib/services/coaService';

interface DisconnectResult {
  sessionId?: string;
  username?: string;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionIds, usernames } = body;

    if (!sessionIds && !usernames) {
      return NextResponse.json(
        { error: 'sessionIds or usernames required' },
        { status: 400 }
      );
    }

    const results: DisconnectResult[] = [];

    // 1. Disconnect by session IDs (acctsessionid in radacct)
    if (sessionIds && Array.isArray(sessionIds)) {
      for (const sessionId of sessionIds) {
        try {
          const session = await prisma.radacct.findFirst({
            where: {
              acctsessionid: sessionId,
              acctstoptime: null,
            },
          });

          if (!session) {
            results.push({
              sessionId,
              success: false,
              error: 'Session not found or already stopped',
            });
            continue;
          }

          const router = await prisma.router.findFirst({
            where: { nasname: session.nasipaddress },
          });

          if (!router) {
            results.push({
              sessionId,
              success: false,
              error: 'Router not configured',
            });
            continue;
          }

          const result = await sendCoADisconnect(
            session.username,
            session.nasipaddress,
            router.secret,
            session.acctsessionid,
            session.framedipaddress
          );

          if (result.success) {
            await prisma.radacct.updateMany({
              where: { acctsessionid: sessionId, acctstoptime: null },
              data: {
                acctstoptime: new Date(),
                acctterminatecause: 'Admin-Reset',
              },
            });
          }

          results.push({
            sessionId,
            username: session.username,
            ...result,
          });
        } catch (error: unknown) {
          const errMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            sessionId,
            success: false,
            error: errMessage,
          });
        }
      }
    }

    // 2. Disconnect by username
    if (usernames && Array.isArray(usernames)) {
      for (const username of usernames) {
        try {
          const session = await prisma.radacct.findFirst({
            where: {
              username,
              acctstoptime: null,
            },
            orderBy: {
              acctstarttime: 'desc',
            },
          });

          if (!session) {
            results.push({
              username,
              success: false,
              error: 'No active session found',
            });
            continue;
          }

          const router = await prisma.router.findFirst({
            where: { nasname: session.nasipaddress },
          });

          if (!router) {
            results.push({
              username,
              success: false,
              error: 'Router not configured',
            });
            continue;
          }

          const result = await sendCoADisconnect(
            session.username,
            session.nasipaddress,
            router.secret,
            session.acctsessionid,
            session.framedipaddress
          );

          if (result.success) {
            await prisma.radacct.updateMany({
              where: { username, acctstoptime: null },
              data: {
                acctstoptime: new Date(),
                acctterminatecause: 'Admin-Reset',
              },
            });
          }

          results.push({
            username,
            sessionId: session.acctsessionid,
            ...result,
          });
        } catch (error: unknown) {
          const errMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            username,
            success: false,
            error: errMessage,
          });
        }
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error('Disconnect sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}