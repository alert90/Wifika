// src/app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, invoices_status } from '@prisma/client';
import { disconnectPPPoEUser } from '@/lib/services/coaService';
import { sendPaymentSuccess } from '@/lib/whatsapp-notifications';
import { randomBytes } from 'crypto';
import { nanoid } from 'nanoid';

function generatePaymentToken(): string {
  return randomBytes(32).toString('hex');
}

const VALID_STATUSES: invoices_status[] = [
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELLED',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: Prisma.invoiceWhereInput = {};
    if (
      status &&
      status !== 'all' &&
      VALID_STATUSES.includes(status as invoices_status)
    ) {
      where.status = status as invoices_status;
    }
    if (userId) where.userId = userId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
            username: true,
            profile: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const [total, unpaid, paid, pending, overdue, totalUnpaid, totalPaid] =
      await Promise.all([
        prisma.invoice.count(),
        prisma.invoice.count({
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
        }),
        prisma.invoice.count({ where: { status: 'PAID' } }),
        prisma.invoice.count({ where: { status: 'PENDING' } }),
        prisma.invoice.count({ where: { status: 'OVERDUE' } }),
        prisma.invoice.aggregate({
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
          _sum: { amount: true },
        }),
        prisma.invoice.aggregate({
          where: { status: 'PAID' },
          _sum: { amount: true },
        }),
      ]);

    return NextResponse.json({
      invoices,
      stats: {
        total,
        unpaid,
        paid,
        pending,
        overdue,
        totalUnpaidAmount: totalUnpaid._sum.amount || 0,
        totalPaidAmount: totalPaid._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount } = body;

    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'User ID and amount are required' },
        { status: 400 }
      );
    }

    const user = await prisma.pppoeUser.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const count = await prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `INV-${year}${month}-` } },
    });
    const invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(
      4,
      '0'
    )}`;

    const company = await prisma.company.findFirst();
    const baseUrl = company?.baseUrl || 'http://localhost:3000';
    const paymentToken = generatePaymentToken();
    const paymentLink = `${baseUrl}/pay/${paymentToken}`;

    const invoice = await prisma.invoice.create({
      data: {
        id: crypto.randomUUID(),
        invoiceNumber,
        userId,
        customerName: user.name,
        customerPhone: user.phone,
        customerUsername: user.username,
        amount,
        dueDate: body.dueDate
          ? new Date(body.dueDate)
          : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
        paymentToken,
        paymentLink,
      },
      include: {
        user: { select: { name: true, phone: true, email: true } },
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, paidAt } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { user: { include: { profile: true } } },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const updateData: Prisma.invoiceUpdateInput = {};
    if (status && VALID_STATUSES.includes(status as invoices_status)) {
      updateData.status = status as invoices_status;
    }
    if (status === 'PAID' && !paidAt) updateData.paidAt = new Date();
    else if (paidAt) updateData.paidAt = new Date(paidAt);

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { name: true, phone: true, email: true } },
      },
    });

    // Activation flow
    if (status === 'PAID' && existingInvoice.status !== 'PAID') {
      const user = existingInvoice.user;

      if (!user || !user.profile) {
        console.warn('[Invoice Payment] No user/profile, skipping activation');
        return NextResponse.json({ invoice });
      }

      const profile = user.profile;

      const currentExpiry = user.expiredAt || new Date();
      const newExpiry = new Date(currentExpiry);

      switch (profile.validityUnit) {
        case 'DAYS':
          newExpiry.setDate(newExpiry.getDate() + profile.validityValue);
          break;
        case 'MONTHS':
          newExpiry.setMonth(newExpiry.getMonth() + profile.validityValue);
          break;
        case 'HOURS':
          newExpiry.setHours(newExpiry.getHours() + profile.validityValue);
          break;
        case 'MINUTES':
          newExpiry.setMinutes(newExpiry.getMinutes() + profile.validityValue);
          break;
      }

      const shouldActivate = ['isolated', 'suspended', 'expired'].includes(
        user.status
      );

      await prisma.pppoeUser.update({
        where: { id: user.id },
        data: {
          expiredAt: newExpiry,
          status: shouldActivate ? 'active' : user.status,
        },
      });

      console.log(`[Invoice Payment] User ${user.name}:`);
      console.log(
        `  Expiry: ${currentExpiry.toISOString()} → ${newExpiry.toISOString()}`
      );

      try {
        const pppoeCategory = await prisma.transactionCategory.findFirst({
          where: { name: 'Pembayaran PPPoE', type: 'INCOME' },
        });

        if (pppoeCategory) {
          const existingTransaction = await prisma.transaction.findFirst({
            where: { reference: `INV-${existingInvoice.invoiceNumber}` },
          });

          if (!existingTransaction) {
            await prisma.$executeRaw`
              INSERT INTO transactions (id, categoryId, type, amount, description, date, reference, notes, createdAt, updatedAt)
              VALUES (${nanoid()}, ${pppoeCategory.id}, 'INCOME', ${existingInvoice.amount},
                      ${`Pembayaran ${profile.name} - ${user.name}`}, NOW(),
                      ${`INV-${existingInvoice.invoiceNumber}`}, 'Manual mark as paid by admin', NOW(), NOW())
            `;
            console.log(`  Keuangan: synced`);
          }
        }
      } catch (keuanganError) {
        console.error('  Keuangan sync error:', keuanganError);
      }

      if (user.phone) {
        try {
          await sendPaymentSuccess({
            customerName: user.name,
            customerPhone: user.phone,
            username: user.username,
            password: user.password,
            profileName: profile.name,
            invoiceNumber: existingInvoice.invoiceNumber,
            amount: existingInvoice.amount,
          });
          console.log(`  WhatsApp: sent`);
        } catch (waError) {
          console.error(`  WhatsApp failed:`, waError);
        }
      }

      if (shouldActivate) {
        console.log(`  Status: ${user.status} → active`);
        try {
          await prisma.$executeRaw`
            INSERT INTO radcheck (username, attribute, op, value)
            VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
            ON DUPLICATE KEY UPDATE value = ${user.password}
          `;
          await prisma.$executeRaw`
            DELETE FROM radusergroup WHERE username = ${user.username}
          `;
          await prisma.$executeRaw`
            INSERT INTO radusergroup (username, groupname, priority)
            VALUES (${user.username}, ${profile.groupName}, 1)
          `;
          await prisma.radreply.deleteMany({
            where: { username: user.username, attribute: 'Reply-Message' },
          });

          if (user.ipAddress) {
            await prisma.$executeRaw`
              INSERT INTO radreply (username, attribute, op, value)
              VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
              ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
            `;
          } else {
            await prisma.$executeRaw`
              DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Framed-IP-Address'
            `;
          }
          console.log(`  RADIUS: restored`);

          const registration = await prisma.registrationRequest.findFirst({
            where: { pppoeUserId: user.id, status: 'INSTALLED' },
          });
          if (registration) {
            await prisma.registrationRequest.update({
              where: { id: registration.id },
              data: { status: 'ACTIVE' },
            });
          }

          // ✅ FIXED: narrowed union type
          const coaResult = await disconnectPPPoEUser(user.username);
          if (coaResult.success) {
            console.log(`  CoA: disconnected`);
          } else {
            const errMsg =
              'error' in coaResult ? coaResult.error : 'No active session';
            console.log(`  CoA: ${errMsg}`);
          }
        } catch (radiusError) {
          console.error(`  RADIUS sync error:`, radiusError);
        }
      }
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}