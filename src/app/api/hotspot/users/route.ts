import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// GET — list hotspot users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const users = await prisma.hotspotUser.findMany({
      where,
      include: { profile: { select: { id: true, name: true, speed: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('List hotspot users error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list hotspot users' },
      { status: 500 }
    );
  }
}

// POST — create hotspot user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, password, profileId, notes } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Normalize phone
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('255')) cleanPhone = '0' + cleanPhone.substring(3);
    if (!cleanPhone.startsWith('0')) cleanPhone = '0' + cleanPhone;

    const existing = await prisma.hotspotUser.findUnique({
      where: { phone: cleanPhone },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Phone number already registered' },
        { status: 409 }
      );
    }

    const user = await prisma.hotspotUser.create({
      data: {
        id: crypto.randomUUID(),
        name,
        phone: cleanPhone,
        email: email || null,
        password: password || null,
        profileId: profileId || null,
        notes: notes || null,
        status: 'active',
      },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    console.error('Create hotspot user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create hotspot user' },
      { status: 500 }
    );
  }
}

// PUT — update
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const user = await prisma.hotspotUser.update({
      where: { id },
      data: {
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.email !== undefined && { email: rest.email }),
        ...(rest.status !== undefined && { status: rest.status }),
        ...(rest.profileId !== undefined && { profileId: rest.profileId }),
        ...(rest.notes !== undefined && { notes: rest.notes }),
        ...(rest.expiredAt !== undefined && {
          expiredAt: rest.expiredAt ? new Date(rest.expiredAt) : null,
        }),
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Update hotspot user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update hotspot user' },
      { status: 500 }
    );
  }
}

// DELETE
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    await prisma.hotspotUser.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete hotspot user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete hotspot user' },
      { status: 500 }
    );
  }
}