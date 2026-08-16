import { prisma } from './prisma';

export interface RadiusUserRecord {
  id: number;
  username: string;
  attribute: string;
  op: string;
  value: string;
}

export async function getRadiusUser(username: string): Promise<RadiusUserRecord[]> {
  try {
    const records = await prisma.radcheck.findMany({
      where: { username }
    });
    return records as RadiusUserRecord[];
  } catch (error) {
    console.error('Error fetching RADIUS user:', error);
    return [];
  }
}