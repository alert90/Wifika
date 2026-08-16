import { prisma } from '@/lib/prisma';
import { sendCoADisconnect } from '@/lib/services/coaService';
import smsService from './sms';

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
    try {
      const profile = await prisma.pppoeProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new Error('Profile not found');
      }

      const user = await prisma.pppoeUser.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('PPPoE User not found');
      }

      // Create record matching `sessions` model
      const session = await prisma.sessions.create({
        data: {
          id: sessionIdToken,
          sessionId: sessionIdToken,
          username: user.username,
          userId: user.id,
          nasIpAddress: '127.0.0.1',
        },
        include: {
          user: true,
        },
      });

      // Provision account credentials into FreeRADIUS radcheck
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
        update: {
          value: user.password,
        },
      });

      return session as unknown as SessionWithRelations;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    try {
      const session = await prisma.sessions.findUnique({
        where: { sessionId },
        include: { user: true },
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Mark local session as stopped
      await prisma.sessions.update({
        where: { sessionId },
        data: {
          stopTime: new Date(),
        },
      });

      // Find active RADIUS accounting record to send disconnect packet
      const radSession = await prisma.radacct.findFirst({
        where: {
          username: session.username,
          acctstoptime: null,
        },
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

        // Close accounting session record
        await prisma.radacct.updateMany({
          where: {
            username: session.username,
            acctstoptime: null,
          },
          data: {
            acctstoptime: new Date(),
            acctterminatecause: 'Admin-Reset',
          },
        });
      }

      console.log(`✅ Session terminated: ${sessionId}`);
    } catch (error) {
      console.error('Error terminating session:', error);
      throw error;
    }
  }

  async getActiveSession(sessionId: string): Promise<SessionWithRelations | null> {
    try {
      const session = await prisma.sessions.findUnique({
        where: { sessionId },
        include: {
          user: true,
        },
      });

      if (!session || session.stopTime !== null) {
        return null;
      }

      return session as unknown as SessionWithRelations;
    } catch (error) {
      console.error('Error getting active session:', error);
      return null;
    }
  }

  async getUserActiveSessions(userId: string): Promise<SessionWithRelations[]> {
    try {
      const sessions = await prisma.sessions.findMany({
        where: {
          userId,
          stopTime: null,
        },
        include: {
          user: true,
        },
        orderBy: {
          startTime: 'desc',
        },
      });

      return sessions as unknown as SessionWithRelations[];
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  async updateSessionUsage(
    sessionId: string,
    uploadBytes: bigint,
    downloadBytes: bigint
  ): Promise<void> {
    try {
      await prisma.sessions.update({
        where: { sessionId },
        data: {
          uploadBytes,
          downloadBytes,
        },
      });
    } catch (error) {
      console.error('Error updating session usage:', error);
    }
  }
}

export const sessionCleanup = async (): Promise<void> => {
  try {
    const activeSessions = await prisma.sessions.findMany({
      where: {
        stopTime: null,
      },
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
  } catch (error) {
    console.error('Error during session cleanup:', error);
  }
};

const sessionService = new SessionService();
export default sessionService;