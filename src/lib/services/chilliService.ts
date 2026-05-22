import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ChilliAuthorizeParams {
  ip: string;
  mac: string;
  username: string;
  sessionTimeout?: number;
  orangePiHost?: string;
  orangePiUser?: string;
}

/**
 * Authorize a user on Orange Pi's CoovaChilli captive portal
 * Uses SSH with config file for passwordless connection
 */
export async function authorizeChilliUser({
  ip,
  mac,
  username,
  sessionTimeout = 86400,
  orangePiHost = process.env.ORANGEPI_HOST || 'orangepi',
  orangePiUser = process.env.ORANGEPI_USER || 'cyber',
}: ChilliAuthorizeParams) {
  try {
    console.log(`[Chilli] Authorizing user: ${username} (IP: ${ip}, MAC: ${mac})`);
    
    // Use the SSH config host entry if it matches
    const sshTarget = orangePiHost === 'orangepi' ? 'orangepi' : `${orangePiUser}@${orangePiHost}`;
    
    // Build SSH command - relies on ~/.ssh/config for key and options
    const sshCommand = `ssh ${sshTarget} "bash /home/cyber/chilli_authorize.sh '${ip}' '${mac}' '${username}' ${sessionTimeout}"`;
    
    console.log(`[Chilli] Executing: ${sshCommand}`);
    
    const { stdout, stderr } = await execAsync(sshCommand, { timeout: 10000 });
    
    if (stderr && !stderr.includes('SUCCESS') && !stderr.includes('Warning')) {
      console.error(`[Chilli] SSH stderr: ${stderr}`);
    }
    
    console.log(`[Chilli] Authorization result: ${stdout}`);
    
    // Check if authorization was successful
    const success = stdout.includes('SUCCESS');
    
    return {
      success,
      message: stdout.trim(),
      error: success ? undefined : 'Authorization failed',
    };
  } catch (error: any) {
    console.error(`[Chilli] Error authorizing user ${username}:`, error.message);
    
    if (error.message.includes('Connection refused') || error.message.includes('Connection timed out')) {
      return {
        success: false,
        error: `Cannot connect to Orange Pi. Make sure Tailscale is running.`,
        details: error.message,
      };
    }
    
    if (error.message.includes('Permission denied')) {
      return {
        success: false,
        error: `SSH authentication failed. Check SSH keys.`,
        details: error.message,
      };
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Alternative method: Using HTTP API if you set up a simple API on Orange Pi
 */
export async function authorizeChilliUserHttp({
  ip,
  mac,
  username,
  sessionTimeout = 86400,
  orangePiHost = process.env.ORANGEPI_HOST || 'orangepi',
  orangePiPort = process.env.ORANGEPI_API_PORT || '3001',
}: Omit<ChilliAuthorizeParams, 'orangePiUser'> & { orangePiPort?: string }) {
  try {
    const url = `http://${orangePiHost}:${orangePiPort}/authorize`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, mac, username, sessionTimeout }),
    });
    
    const data = await response.json();
    
    return {
      success: data.success,
      message: data.message,
      error: data.error,
    };
  } catch (error: any) {
    console.error(`[Chilli] HTTP API error:`, error.message);
    return {
      success: false,
      error: `Failed to connect to Orange Pi API: ${error.message}`,
    };
  }
}

/**
 * Disconnect a user from CoovaChilli
 */
export async function disconnectChilliUser(
  ip: string,
  orangePiHost = process.env.ORANGEPI_HOST || 'orangepi',
  orangePiUser = process.env.ORANGEPI_USER || 'cyber',
) {
  try {
    const sshTarget = orangePiHost === 'orangepi' ? 'orangepi' : `${orangePiUser}@${orangePiHost}`;
    const sshCommand = `ssh ${sshTarget} "sudo chilli_query logout ${ip}"`;
    
    const { stdout } = await execAsync(sshCommand);
    
    return {
      success: true,
      message: stdout.trim(),
    };
  } catch (error: any) {
    console.error(`[Chilli] Error disconnecting user:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List all active sessions on CoovaChilli
 */
export async function listChilliSessions(
  orangePiHost = process.env.ORANGEPI_HOST || 'orangepi',
  orangePiUser = process.env.ORANGEPI_USER || 'cyber',
) {
  try {
    const sshTarget = orangePiHost === 'orangepi' ? 'orangepi' : `${orangePiUser}@${orangePiHost}`;
    const sshCommand = `ssh ${sshTarget} "sudo chilli_query list"`;
    
    const { stdout } = await execAsync(sshCommand);
    
    // Parse chilli_query list output
    const sessions = stdout.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split(/\s+/);
      return {
        mac: parts[0],
        ip: parts[1],
        state: parts[2],
        sessionId: parts[3],
        username: parts[8] || '-',
      };
    });
    
    return {
      success: true,
      sessions,
    };
  } catch (error: any) {
    console.error(`[Chilli] Error listing sessions:`, error.message);
    return {
      success: false,
      error: error.message,
      sessions: [],
    };
  }
}

export default {
  authorizeChilliUser,
  authorizeChilliUserHttp,
  disconnectChilliUser,
  listChilliSessions,
};