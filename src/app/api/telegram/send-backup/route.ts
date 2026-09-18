// src/app/api/telegram/send-backup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendBackupToTelegram } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { backupId } = body;

    if (!backupId) {
      return NextResponse.json(
        { error: 'Backup ID is required' },
        { status: 400 }
      );
    }

    const backup = await prisma.backupHistory.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    if (!backup.filepath) {
      return NextResponse.json(
        { error: 'Backup file path missing' },
        { status: 400 }
      );
    }

    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'Telegram backup settings not configured' },
        { status: 400 }
      );
    }

    const result = await sendBackupToTelegram(
      {
        botToken: settings.botToken,
        chatId: settings.chatId,
        topicId: settings.backupTopicId || undefined,
      },
      backup.filepath,
      backup.filesize
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send backup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}