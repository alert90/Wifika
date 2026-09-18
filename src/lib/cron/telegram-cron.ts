// src/lib/cron/telegram-cron.ts
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { sendBackupToTelegram, sendHealthReport } from '@/lib/telegram';
import { createBackup } from '@/lib/backup';
import * as fs from 'fs/promises';

let backupCronJob: ScheduledTask | null = null;
let healthCronJob: ScheduledTask | null = null;

/**
 * Create and send database backup to Telegram
 */
export async function autoBackupToTelegram(): Promise<{
  success: boolean;
  error?: string;
}> {
  const startedAt = new Date();

  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'telegram_backup',
      status: 'running',
      startedAt,
    },
  });

  try {
    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      const completedAt = new Date();
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: 'Telegram backup disabled, skipped',
        },
      });
      return { success: true };
    }

    console.log('[Telegram Backup] Creating database backup...');
    const backupResult = await createBackup('auto');

    if (!backupResult.success) {
      throw new Error('Backup creation failed');
    }

    const backup = backupResult.backup;

    try {
      await fs.access(backupResult.filepath);
    } catch {
      throw new Error('Backup file not found on disk');
    }

    console.log('[Telegram Backup] Sending backup to Telegram...');
    const sendResult = await sendBackupToTelegram(
      {
        botToken: settings.botToken,
        chatId: settings.chatId,
        topicId: settings.backupTopicId || undefined,
      },
      backupResult.filepath,
      backup.filesize
    );

    if (!sendResult.success) {
      throw new Error(sendResult.error || 'Failed to send to Telegram');
    }

    if (settings.keepLastN > 0) {
      const allBackups = await prisma.backupHistory.findMany({
        where: { type: 'auto' },
        orderBy: { createdAt: 'desc' },
      });

      const backupsToDelete = allBackups.slice(settings.keepLastN);

      for (const oldBackup of backupsToDelete) {
        try {
          if (oldBackup.filepath) {
            await fs.unlink(oldBackup.filepath);
          }
          await prisma.backupHistory.delete({ where: { id: oldBackup.id } });
          console.log(
            `[Telegram Backup] Deleted old backup: ${oldBackup.filename}`
          );
        } catch (error) {
          console.error(
            `[Telegram Backup] Failed to delete ${oldBackup.filename}:`,
            error
          );
        }
      }
    }

    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Backup sent to Telegram: ${backup.filename}`,
      },
    });

    console.log('[Telegram Backup] Completed successfully');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Telegram Backup] Error:', error);

    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: message,
      },
    });

    return { success: false, error: message };
  }
}

/**
 * Send comprehensive health check to Telegram
 */
export async function sendHealthCheckToTelegram(): Promise<{
  success: boolean;
  error?: string;
}> {
  const startedAt = new Date();

  const history = await prisma.cronHistory.create({
    data: {
      id: nanoid(),
      jobType: 'telegram_health',
      status: 'running',
      startedAt,
    },
  });

  try {
    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      const completedAt = new Date();
      await prisma.cronHistory.update({
        where: { id: history.id },
        data: {
          status: 'success',
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          result: 'Telegram health check disabled, skipped',
        },
      });
      return { success: true };
    }

    const health = await getComprehensiveHealth();

    console.log('[Telegram Health] Sending health report...');
    const sendResult = await sendHealthReport(
      {
        botToken: settings.botToken,
        chatId: settings.chatId,
        topicId: settings.healthTopicId || undefined,
      },
      health
    );

    if (!sendResult.success) {
      throw new Error(sendResult.error || 'Failed to send to Telegram');
    }

    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'success',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        result: `Health report sent (status: ${health.status})`,
      },
    });

    console.log('[Telegram Health] Completed successfully');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Telegram Health] Error:', error);

    const completedAt = new Date();
    await prisma.cronHistory.update({
      where: { id: history.id },
      data: {
        status: 'error',
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        error: message,
      },
    });

    return { success: false, error: message };
  }
}

interface ComprehensiveHealth {
  status: string;
  size: string;
  tables: number;
  connections: string;
  uptime: string;
  activeSessions: number;
  totalUsers: number;
  activeUsers: number;
  pendingInvoices: number;
  issues?: string;
}

async function getComprehensiveHealth(): Promise<ComprehensiveHealth> {
  try {
    const sizeResult: Array<{ size_mb: number }> = await prisma.$queryRawUnsafe(
      `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
       FROM information_schema.TABLES
       WHERE table_schema = DATABASE()`
    );

    const tableResult: Array<{ count: bigint | number }> =
      await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM information_schema.TABLES WHERE table_schema = DATABASE()`
      );

    const connectionResult: Array<{ Value: string }> =
      await prisma.$queryRawUnsafe(`SHOW STATUS LIKE 'Threads_connected'`);

    const uptimeResult: Array<{ Value: string }> = await prisma.$queryRawUnsafe(
      `SHOW STATUS LIKE 'Uptime'`
    );

    const activeSessions = await prisma.radacct.count({
      where: { acctstoptime: null },
    });

    const pendingInvoices = await prisma.invoice.count({
      where: { status: 'PENDING', dueDate: { lt: new Date() } },
    });

    const totalUsers = await prisma.pppoeUser.count();
    const activeUsers = await prisma.pppoeUser.count({
      where: { status: 'ACTIVE' },
    });

    const sizeMB = sizeResult[0]?.size_mb || 0;
    const tableCount = Number(tableResult[0]?.count) || 0;
    const connections = connectionResult[0]?.Value || '0';
    const uptimeSeconds = Number(uptimeResult[0]?.Value) || 0;

    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptime = `${days}d ${hours}h`;

    let status = 'healthy';
    const issues: string[] = [];

    if (sizeMB > 5000) {
      status = 'critical';
      issues.push('Database size > 5GB');
    } else if (sizeMB > 1000) {
      status = 'warning';
      issues.push('Database size > 1GB');
    }

    if (Number(connections) > 100) {
      status = 'critical';
      issues.push('Too many DB connections');
    } else if (Number(connections) > 50) {
      if (status === 'healthy') status = 'warning';
      issues.push('High DB connections');
    }

    if (pendingInvoices > 50) {
      if (status === 'healthy') status = 'warning';
      issues.push(`${pendingInvoices} overdue invoices`);
    }

    return {
      status,
      size: `${sizeMB} MB`,
      tables: tableCount,
      connections,
      uptime,
      activeSessions,
      totalUsers,
      activeUsers,
      pendingInvoices,
      issues: issues.length > 0 ? issues.join(', ') : undefined,
    };
  } catch (error) {
    console.error('[Health Check] Error:', error);
    return {
      status: 'unknown',
      size: 'N/A',
      tables: 0,
      connections: 'N/A',
      uptime: 'N/A',
      activeSessions: 0,
      totalUsers: 0,
      activeUsers: 0,
      pendingInvoices: 0,
    };
  }
}

/**
 * Start or restart backup cron job based on settings
 */
export async function startBackupCron() {
  try {
    if (backupCronJob) {
      backupCronJob.stop();
      backupCronJob = null;
    }

    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      console.log('[Telegram Backup Cron] Disabled or not configured, skipping');
      return;
    }

    console.log('[Telegram Backup Cron] Settings found:', {
      enabled: settings.enabled,
      schedule: settings.schedule,
      scheduleTime: settings.scheduleTime,
    });

    const [hour, minute] = settings.scheduleTime.split(':').map(Number);

    let cronExpression = '';

    switch (settings.schedule) {
      case 'daily':
        cronExpression = `${minute} ${hour} * * *`;
        break;
      case '12h':
        cronExpression = `${minute} ${hour},${(hour + 12) % 24} * * *`;
        break;
      case '6h':
        cronExpression = `${minute} ${hour},${(hour + 6) % 24},${
          (hour + 12) % 24
        },${(hour + 18) % 24} * * *`;
        break;
      case 'weekly':
        cronExpression = `${minute} ${hour} * * 0`;
        break;
      default:
        cronExpression = `${minute} ${hour} * * *`;
    }

    console.log(
      `[Telegram Backup Cron] Starting with schedule: ${settings.schedule} at ${settings.scheduleTime} (cron: ${cronExpression})`
    );

    backupCronJob = cron.schedule(
      cronExpression,
      async () => {
        console.log('[Telegram Backup Cron] Running...');
        const result = await autoBackupToTelegram();
        console.log('[Telegram Backup Cron] Result:', result);
      },
      { timezone: 'Africa/Dar_es_Salaam' }
    );

    backupCronJob.start();
    console.log('[Telegram Backup Cron] Successfully started');
  } catch (error) {
    console.error('[Telegram Backup Cron] Failed to start:', error);
  }
}

/**
 * Start health check cron (runs every hour)
 */
export async function startHealthCron() {
  try {
    if (healthCronJob) {
      healthCronJob.stop();
      healthCronJob = null;
    }

    const settings = await prisma.telegramBackupSettings.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      console.log('[Telegram Health Cron] Disabled or not configured, skipping');
      return;
    }

    console.log('[Telegram Health Cron] Starting (every hour at :00)');

    healthCronJob = cron.schedule(
      '0 * * * *',
      async () => {
        console.log('[Telegram Health Cron] Running...');
        const result = await sendHealthCheckToTelegram();
        console.log('[Telegram Health Cron] Result:', result);
      },
      { timezone: 'Africa/Dar_es_Salaam' }
    );

    healthCronJob.start();
    console.log('[Telegram Health Cron] Successfully started');
  } catch (error) {
    console.error('[Telegram Health Cron] Failed to start:', error);
  }
}

export function stopBackupCron() {
  if (backupCronJob) {
    backupCronJob.stop();
    backupCronJob = null;
    console.log('[Telegram Backup Cron] Stopped');
  }
}

export function stopHealthCron() {
  if (healthCronJob) {
    healthCronJob.stop();
    healthCronJob = null;
    console.log('[Telegram Health Cron] Stopped');
  }
}

export function getTelegramCronStatus() {
  return {
    backup: { running: backupCronJob !== null },
    health: { running: healthCronJob !== null },
  };
}