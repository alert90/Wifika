import { prisma } from '@/lib/prisma';
import { sendCoADisconnect } from '@/lib/services/coaService';
import smsService from './sms';

export class SessionService {
  async createSession(userId: string, planId: string, sessionToken: string): Promise<any> {
    try {
      const plan = await prisma.plan.findUnique({
        where: { id: planId }
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      const endTime = new Date();
      endTime.setHours(endTime.getHours() + plan.duration);

      const session = await prisma.session.create({
        data: {
          userId,
          planId,
          sessionToken,
          endTime,
          status: 'ACTIVE'
        },
        include: {
          user: true,
          plan: true
        }
      });

      // Provision account credentials directly into FreeRADIUS radcheck
      await prisma.radcheck.upsert({
        where: {
          username_attribute: {
            username: sessionToken,
            attribute: 'Cleartext-Password'
          }
        },
        create: {
          username: sessionToken,
          attribute: 'Cleartext-Password',
          op: ':=',
          value: sessionToken
        },
        update: {
          value: sessionToken
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true }
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Update local database session status
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'TERMINATED',
          endTime: new Date()
        }
      });

      // Find active RADIUS accounting record to execute disconnect packet
      const radSession = await prisma.radacct.findFirst({
        where: {
          username: session.sessionToken,
          acctstoptime: null
        }
      });

      if (radSession) {
        const router = await prisma.router.findFirst({
          where: { nasname: radSession.nasipaddress }
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

        // Close the accounting session record
        await prisma.radacct.updateMany({
          where: {
            username: session.sessionToken,
            acctstoptime: null
          },
          data: {
            acctstoptime: new Date(),
            acctterminatecause: 'Admin-Reset'
          }
        });
      }

      console.log(`✅ Session terminated: ${sessionId}`);
    } catch (error) {
      console.error('Error terminating session:', error);
      throw error;
    }
  }

  async getActiveSession(sessionToken: string): Promise<any> {
    try {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: {
          user: true,
          plan: true
        }
      });

      if (!session || session.status !== 'ACTIVE') {
        return null;
      }

      if (session.endTime && new Date() > session.endTime) {
        await this.terminateSession(session.id);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error getting active session:', error);
      return null;
    }
  }

  async getUserActiveSessions(userId: string): Promise<any[]> {
    try {
      return await prisma.session.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          endTime: {
            gt: new Date()
          }
        },
        include: {
          plan: true
        },
        orderBy: {
          startTime: 'desc'
        }
      });
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  async updateSessionUsage(sessionToken: string, dataUsed: number): Promise<void> {
    try {
      await prisma.session.update({
        where: { sessionToken },
        data: { dataUsed }
      });
    } catch (error) {
      console.error('Error updating session usage:', error);
    }
  }
}

export const sessionCleanup = async (): Promise<void> => {
  try {
    const expiredSessions = await prisma.session.findMany({
      where: {
        status: 'ACTIVE',
        endTime: {
          lt: new Date()
        }
      }
    });

    for (const session of expiredSessions) {
      await new SessionService().terminateSession(session.id);
      
      const user = await prisma.user.findUnique({
        where: { id: session.userId }
      });

      if (user) {
        await smsService.sendSMS(
          user.phone,
          'Your internet session has expired. Purchase a new plan to continue browsing. - COLLOSPOT'
        );
      }
    }

    if (expiredSessions.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions`);
    }
  } catch (error) {
    console.error('Error during session cleanup:', error);
  }
};

export default new SessionService();