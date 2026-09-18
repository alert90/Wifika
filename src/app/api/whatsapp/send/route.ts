// src/app/api/whatsapp/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppService } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Phone and message are required' },
        { status: 400 }
      );
    }

    const result = await WhatsAppService.sendMessage({ phone, message });

    const lastFailure = result.attempts?.[result.attempts.length - 1];

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: lastFailure?.error || 'All providers failed',
          attempts: result.attempts,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Send WhatsApp error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}