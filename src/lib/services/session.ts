// src/lib/services/session.ts
import { prisma } from '@/lib/prisma';
import { sendCoADisconnect } from '@/lib/services/coaService';
import smsService from '@/lib/sms';

export interface SessionWithRelations {
  id: string;
  username: string;
  userId: string | null;
  nasIpAddress: string;
  sessionId: string;
  startTime: Date;
  stopTime: Date | null;
  uploadBytes: bigint;
  downloadBytes: bigint;
  createdAt: Date;
  user?: Record<string, unknown> | null;
}

export class SessionService {
  async createSession(
    userId: string,
    profileId: string,
    sessionIdToken: string
  ): Promise<SessionWithRelations> {
    const profile = await prisma.pppoeProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) throw new Error('Profile not found');

    const user = await prisma.pppoeUser.findUnique({ where: { id: userId } });
    if (!user) throw new Error('PPPoE User not found');

    const session = await prisma.sessions.create({
      data: {
        id: sessionIdToken,
        sessionId: sessionIdToken,
        username: user.username,
        userId: user.id,
        nasIpAddress: '127.0.0.1',
      },
      include: { user: true },
    });

    await prisma.radcheck.upsert({
      where: {
        username_attribute: {
          username: user.username,
          attribute: 'Cleartext-Password',
        },
      },
      create: {
        username: user.username,
        attribute: 'Cleartext-Password',
        op: ':=',
        value: user.password,
      },
      update: { value: user.password },
    });

    return session as unknown as SessionWithRelations;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = await prisma.sessions.findUnique({
      where: { sessionId },
      include: { user: true },
    });
    if (!session) throw new Error('Session not found');

    await prisma.sessions.update({
      where: { sessionId },
      data: { stopTime: new Date() },
    });

    const radSession = await prisma.radacct.findFirst({
      where: { username: session.username, acctstoptime: null },
    });

    if (radSession) {
      const router = await prisma.router.findFirst({
        where: { nasname: radSession.nasipaddress },
      });

      if (router) {
        await sendCoADisconnect(
          radSession.username,
          radSession.nasipaddress,
          router.secret,
          radSession.acctsessionid,
          radSession.framedipaddress
        );
      }

      await prisma.radacct.updateMany({
        where: { username: session.username, acctstoptime: null },
        data: {
          acctstoptime: new Date(),
          acctterminatecause: 'Admin-Reset',
        },
      });
    }

    console.log(`✅ Session terminated: ${sessionId}`);
  }

  async getActiveSession(
    sessionId: string
  ): Promise<SessionWithRelations | null> {
    const session = await prisma.sessions.findUnique({
      where: { sessionId },
      include: { user: true },
    });
    if (!session || session.stopTime !== null) return null;
    return session as unknown as SessionWithRelations;
  }

  async getUserActiveSessions(
    userId: string
  ): Promise<SessionWithRelations[]> {
    const sessions = await prisma.sessions.findMany({
      where: { userId, stopTime: null },
      include: { user: true },
      orderBy: { startTime: 'desc' },
    });
    return sessions as unknown as SessionWithRelations[];
  }

  async updateSessionUsage(
    sessionId: string,
    uploadBytes: bigint,
    downloadBytes: bigint
  ): Promise<void> {
    await prisma.sessions.update({
      where: { sessionId },
      data: { uploadBytes, downloadBytes },
    });
  }
}

export const sessionCleanup = async (): Promise<void> => {
  const activeSessions = await prisma.sessions.findMany({
    where: { stopTime: null },
  });

  for (const session of activeSessions) {
    if (!session.userId) continue;

    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
    });

    if (user && user.expiredAt && new Date() > user.expiredAt) {
      await new SessionService().terminateSession(session.sessionId);

      if (user.phone) {
        await smsService.sendSMS(
          user.phone,
          'Your internet session has expired. Purchase a new plan to continue browsing. - SKYLINK'
        );
      }
    }
  }
};

const sessionService = new SessionService();
export default sessionService;