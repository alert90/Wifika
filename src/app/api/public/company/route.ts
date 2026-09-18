// src/app/api/public/company/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const company = await prisma.company.findFirst({
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        adminPhone: true,
        baseUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      company: company || {
        name: 'Skylink',
        address: null,
        phone: null,
        email: null,
        logo: null,
        adminPhone: null,
        baseUrl: null,
      },
    });
  } catch (error) {
    console.error('Get public company error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch company info' },
      { status: 500 }
    );
  }
}