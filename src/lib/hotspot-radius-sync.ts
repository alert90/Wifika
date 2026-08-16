import { prisma } from './prisma';

function parseSpeedToBps(speed: string): { downBps: number; upBps: number } {
  const parts = speed.trim().split('/');
  const parsePart = (val: string) => {
    const num = parseFloat(val) || 0;
    if (val.toUpperCase().endsWith('G')) return num * 1024 * 1024 * 1024;
    if (val.toUpperCase().endsWith('M')) return num * 1024 * 1024;
    if (val.toUpperCase().endsWith('K')) return num * 1024;
    return num;
  };

  const downBps = parsePart(parts[0]);
  const upBps = parts.length > 1 ? parsePart(parts[1]) : downBps;
  return { downBps, upBps };
}

export async function syncProfileToRadius(profileId: string) {
  try {
    const profile = await prisma.hotspotProfile.findUnique({
      where: { id: profileId }
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    const groupName = profile.groupProfile || `hs-${profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    await prisma.radgroupreply.deleteMany({
      where: { groupname: groupName }
    });

    const { downBps, upBps } = parseSpeedToBps(profile.speed);

    await prisma.radgroupreply.createMany({
      data: [
        {
          groupname: groupName,
          attribute: 'ChilliSpot-Bandwidth-Max-Down',
          op: ':=',
          value: downBps.toString()
        },
        {
          groupname: groupName,
          attribute: 'ChilliSpot-Bandwidth-Max-Up',
          op: ':=',
          value: upBps.toString()
        },
        {
          groupname: groupName,
          attribute: 'Simultaneous-Use',
          op: ':=',
          value: profile.sharedUsers.toString()
        },
        {
          groupname: groupName,
          attribute: 'Acct-Interim-Interval',
          op: ':=',
          value: '60'
        }
      ]
    });

    return { success: true, groupName };
  } catch (error) {
    console.error('Sync profile to RADIUS error:', error);
    throw error;
  }
}

export async function syncVoucherToRadius(voucherId: string) {
  try {
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { id: voucherId },
      include: { profile: true }
    });

    if (!voucher) {
      throw new Error('Voucher not found');
    }

    const profileName = voucher.profile.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueGroupName = `hotspot-${profileName}-${voucher.code}`;

    await prisma.radcheck.upsert({
      where: {
        username_attribute: {
          username: voucher.code,
          attribute: 'Cleartext-Password'
        }
      },
      create: {
        username: voucher.code,
        attribute: 'Cleartext-Password',
        op: ':=',
        value: voucher.code
      },
      update: {
        value: voucher.code
      }
    });

    await prisma.radusergroup.upsert({
      where: {
        username_groupname: {
          username: voucher.code,
          groupname: uniqueGroupName
        }
      },
      create: {
        username: voucher.code,
        groupname: uniqueGroupName,
        priority: 1
      },
      update: {
        priority: 1
      }
    });

    await prisma.radgroupreply.deleteMany({
      where: { groupname: uniqueGroupName }
    });

    let sessionTimeout = 0;
    switch (voucher.profile.validityUnit) {
      case 'MINUTES':
        sessionTimeout = voucher.profile.validityValue * 60;
        break;
      case 'HOURS':
        sessionTimeout = voucher.profile.validityValue * 3600;
        break;
      case 'DAYS':
        sessionTimeout = voucher.profile.validityValue * 86400;
        break;
      case 'MONTHS':
        sessionTimeout = voucher.profile.validityValue * 30 * 86400;
        break;
    }

    const { downBps, upBps } = parseSpeedToBps(voucher.profile.speed);

    await prisma.radgroupreply.createMany({
      data: [
        {
          groupname: uniqueGroupName,
          attribute: 'ChilliSpot-Bandwidth-Max-Down',
          op: ':=',
          value: downBps.toString()
        },
        {
          groupname: uniqueGroupName,
          attribute: 'ChilliSpot-Bandwidth-Max-Up',
          op: ':=',
          value: upBps.toString()
        },
        {
          groupname: uniqueGroupName,
          attribute: 'Session-Timeout',
          op: ':=',
          value: sessionTimeout.toString()
        },
        {
          groupname: uniqueGroupName,
          attribute: 'Acct-Interim-Interval',
          op: ':=',
          value: '60'
        }
      ]
    });

    return { success: true, groupName: uniqueGroupName };
  } catch (error) {
    console.error('Sync voucher to RADIUS error:', error);
    throw error;
  }
}

export async function removeVoucherFromRadius(code: string) {
  try {
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code },
      include: { profile: true }
    });

    if (voucher) {
      const profileName = voucher.profile.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueGroupName = `hotspot-${profileName}-${code}`;
      
      await prisma.radgroupreply.deleteMany({
        where: { groupname: uniqueGroupName }
      });
    }

    await prisma.radcheck.deleteMany({
      where: { username: code }
    });

    await prisma.radusergroup.deleteMany({
      where: { username: code }
    });

    return { success: true };
  } catch (error) {
    console.error('Remove voucher from RADIUS error:', error);
    throw error;
  }
}

export async function syncBatchToRadius(batchCode: string) {
  try {
    const vouchers = await prisma.hotspotVoucher.findMany({
      where: { batchCode },
      include: { profile: true }
    });

    let successCount = 0;
    const errors: { voucherId: string; error: string }[] = [];

    for (const voucher of vouchers) {
      try {
        await syncVoucherToRadius(voucher.id);
        successCount++;
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ voucherId: voucher.id, error: errMessage });
      }
    }

    return {
      total: vouchers.length,
      successCount,
      failedCount: errors.length,
      errors
    };
  } catch (error) {
    console.error('Sync batch to RADIUS error:', error);
    throw error;
  }
}