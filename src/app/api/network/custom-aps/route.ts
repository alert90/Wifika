import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// If you have a Prisma model named "customAp" (or similar), replace accordingly.
// Below assumes a model "networkCustomAP" with fields:
//   id String, name String, ipAddress String, latitude Float, longitude Float, status String
// If the model doesn't exist yet, you need to add it to schema.prisma and run a migration.

// GET – fetch all custom APs
export async function GET() {
  try {
    const aps = await prisma.networkCustomAP.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: aps });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST – create a new custom AP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ipAddress, latitude, longitude, status } = body;

    if (!name || !ipAddress || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, IP, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const ap = await prisma.networkCustomAP.create({
      data: {
        id: nanoid(),
        name,
        ipAddress,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: status || 'online',
      },
    });

    return NextResponse.json({ success: true, data: ap });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT – update a custom AP
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, ipAddress, latitude, longitude, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    const ap = await prisma.networkCustomAP.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(ipAddress && { ipAddress }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({ success: true, data: ap });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE – remove a custom AP
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await prisma.networkCustomAP.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Custom AP deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}