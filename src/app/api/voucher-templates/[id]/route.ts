// src/app/api/voucher-templates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface PrismaError {
  code?: string;
  message?: string;
}

// GET single template
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const template = await prisma.voucherTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT update template
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, htmlTemplate, isDefault, isActive } = body;

    if (isDefault) {
      await prisma.voucherTemplate.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.voucherTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(htmlTemplate && { htmlTemplate }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Update template error:', error);

    const prismaError = error as PrismaError;
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE template
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    await prisma.voucherTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);

    const prismaError = error as PrismaError;
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}