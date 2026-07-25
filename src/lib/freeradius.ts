import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let lastRestartTime = 0;
const RESTART_COOLDOWN = 3000; // 3 seconds cooldown

/**
 * Reloads FreeRADIUS daemon configuration smoothly.
 */
export async function reloadFreeRadius(): Promise<void> {
  const now = Date.now();

  if (now - lastRestartTime < RESTART_COOLDOWN) {
    console.log('FreeRADIUS reload skipped (cooldown active)');
    return;
  }

  try {
    lastRestartTime = now;

    const { stderr } = await execAsync('sudo systemctl reload freeradius', {
      timeout: 10000
    });

    if (stderr) {
      console.warn('FreeRADIUS reload warning:', stderr);
    }

    console.log('FreeRADIUS reloaded successfully');
  } catch (error: any) {
    console.error('Failed to reload FreeRADIUS:', error.message);
  }
}