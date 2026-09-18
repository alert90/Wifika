// src/lib/freeradius.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from './prisma';

const execAsync = promisify(exec);

export interface RadiusUserRecord {
  id: number;
  username: string;
  attribute: string;
  op: string;
  value: string;
}

export async function getRadiusUser(username: string): Promise<RadiusUserRecord[]> {
  try {
    const records = await prisma.radcheck.findMany({ where: { username } });
    return records as RadiusUserRecord[];
  } catch (error) {
    console.error('Error fetching RADIUS user:', error);
    return [];
  }
}

export async function reloadFreeRadius(): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync('systemctl reload freeradius || systemctl restart freeradius');
    console.log('[FreeRADIUS] Reloaded');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FreeRADIUS] Reload failed:', msg);
    return { success: false, error: msg };
  }
}