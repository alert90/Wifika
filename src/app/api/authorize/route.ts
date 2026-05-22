import { NextRequest, NextResponse } from 'next/server';
import { authorizeChilliUser, authorizeChilliUserHttp } from '@/lib/services/chilliService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ip, mac, username, sessionTimeout } = body;

    if (!ip || !mac || !username) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: ip, mac, username' },
        { status: 400 }
      );
    }

    console.log(`[Authorize] Processing authorization for ${username} (IP: ${ip}, MAC: ${mac})`);

    // Validate user/voucher exists and is active
    let isValid = true;
    let userType: 'pppoe' | 'voucher' = 'voucher';
    
    // Check if it's a voucher
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code: username },
      include: { profile: true },
    });

    if (voucher) {
      userType = 'voucher';
      
      // Check if voucher is valid
      if (voucher.status === 'EXPIRED') {
        return NextResponse.json(
          { success: false, error: 'Voucher has expired' },
          { status: 403 }
        );
      }
      
      if (voucher.status === 'ACTIVE' && voucher.lastUsedBy && 
          voucher.lastUsedBy !== 'Anonymous' && voucher.lastUsedBy !== 'Voucher User') {
        // Check if this is the same MAC trying to reconnect
        const existingSession = await prisma.radacct.findFirst({
          where: {
            username,
            acctstoptime: null,
          },
        });
        
        if (existingSession && existingSession.callingstationid !== mac) {
          return NextResponse.json(
            { success: false, error: 'Voucher is already in use on another device' },
            { status: 403 }
          );
        }
      }
    } else {
      // Check if it's a PPPoE user
      const pppoeUser = await prisma.pppoeUser.findUnique({
        where: { username },
      });
      
      if (pppoeUser) {
        userType = 'pppoe';
        
        if (pppoeUser.status !== 'active') {
          return NextResponse.json(
            { success: false, error: 'Account is not active' },
            { status: 403 }
          );
        }
        
        if (pppoeUser.expiredAt && new Date() > pppoeUser.expiredAt) {
          return NextResponse.json(
            { success: false, error: 'Account has expired' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid username or voucher code' },
          { status: 404 }
        );
      }
    }

    // Authorize on Orange Pi
    // Try HTTP API first (faster), fallback to SSH
    let authResult;
    
    // Check if we should use HTTP API (set ORANGEPI_API_PORT in .env)
    if (process.env.ORANGEPI_API_PORT) {
      authResult = await authorizeChilliUserHttp({
        ip,
        mac,
        username,
        sessionTimeout,
      });
    } else {
      // Fallback to SSH
      authResult = await authorizeChilliUser({
        ip,
        mac,
        username,
        sessionTimeout,
      });
    }

    if (!authResult.success) {
      console.error(`[Authorize] Orange Pi authorization failed:`, authResult.error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to authorize session on access point',
          details: authResult.error 
        },
        { status: 500 }
      );
    }

    // Log successful authorization
    console.log(`[Authorize] Successfully authorized ${username} on Orange Pi`);

    return NextResponse.json({
      success: true,
      message: 'Session authorized successfully',
      userType,
      sessionTimeout,
      authResult: authResult.message,
    });
  } catch (error: any) {
    console.error('[Authorize] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}