// src/app/api/keuangan/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

interface ExportRow {
  Tanggal: string;
  Deskripsi: string;
  Kategori: string;
  Tipe: string;
  Jumlah: number | string;
  Referensi: string;
  Catatan: string;
}

interface ExportStats {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  pppoeIncome: number;
  pppoeCount: number;
  hotspotIncome: number;
  hotspotCount: number;
  installIncome: number;
  installCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const startFilter = new Date(startDate);
    const endFilter = new Date(endDate);
    endFilter.setHours(23, 59, 59, 999);

    const where: Prisma.transactionWhereInput = {
      date: { gte: startFilter, lte: endFilter },
    };

    if (type === 'INCOME' || type === 'EXPENSE') {
      where.type = type;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'asc' },
    });

    const totalIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpense;

    const pppoeIncome = transactions
      .filter((t) => t.type === 'INCOME' && t.category.name === 'Payment PPPoE')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const pppoeCount = transactions.filter(
      (t) => t.type === 'INCOME' && t.category.name === 'Payment PPPoE'
    ).length;

    const hotspotIncome = transactions
      .filter((t) => t.type === 'INCOME' && t.category.name === 'Payment Hotspot')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const hotspotCount = transactions.filter(
      (t) => t.type === 'INCOME' && t.category.name === 'Payment Hotspot'
    ).length;

    const installIncome = transactions
      .filter((t) => t.type === 'INCOME' && t.category.name === 'Installation Costs')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const installCount = transactions.filter(
      (t) => t.type === 'INCOME' && t.category.name === 'Installation Costs'
    ).length;

    const stats: ExportStats = {
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      balance,
      pppoeIncome,
      pppoeCount,
      hotspotIncome,
      hotspotCount,
      installIncome,
      installCount,
    };

    if (format === 'excel') {
      return exportToExcel(transactions, stats);
    }
    return exportToPDF(transactions, stats);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

function exportToExcel(
  transactions: Array<{
    date: Date;
    description: string;
    category: { name: string };
    type: string;
    amount: number;
    reference: string | null;
    notes: string | null;
  }>,
  stats: ExportStats
) {
  const data: ExportRow[] = transactions.map((t) => ({
    Tanggal: new Date(t.date).toLocaleDateString('id-ID'),
    Deskripsi: t.description,
    Kategori: t.category.name,
    Tipe: t.type,
    Jumlah: Number(t.amount),
    Referensi: t.reference || '-',
    Catatan: t.notes || '-',
  }));

  data.push({ Tanggal: '', Deskripsi: '', Kategori: '', Tipe: '', Jumlah: 0, Referensi: '', Catatan: '' });
  data.push({ Tanggal: 'RINGKASAN', Deskripsi: '', Kategori: '', Tipe: '', Jumlah: 0, Referensi: '', Catatan: '' });
  data.push({ Tanggal: 'Total Income', Deskripsi: '', Kategori: '', Tipe: '', Jumlah: stats.totalIncome, Referensi: '', Catatan: '' });
  data.push({ Tanggal: '  - PPPoE', Deskripsi: '', Kategori: '', Tipe: '', Jumlah: stats.pppoeIncome, Referensi: `${stats.pppoeCount} transaksi`, Catatan: '' });
  data.push({ Tanggal: '  - Hotspot', Deskripsi: '', Kategori: '', Tipe: '', Jumlah: stats.hotspotIncome, Referensi: `${stats.hotspotCount} transaksi`, Catatan: '' });
  data.push({ Tanggal: '  - Instalasi', Deskripsi: '', Kategori: '', Tipe: '', Jumlah: stats.installIncome, Referensi: `${stats.installCount} transaksi`, Catatan: '' });
  data.push({ Tanggal: 'Total Expense', Deskripsi: '', Kategori: '', Tipe: '', Jumlah: stats.totalExpense, Referensi: '', Catatan: '' });
  data.push({ Tanggal: 'Net Balance', Deskripsi: '', Kategori: '', Tipe: '', Jumlah: stats.balance, Referensi: '', Catatan: '' });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi Keuangan');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Laporan-Keuangan-${stats.startDate}-${stats.endDate}.xlsx"`,
    },
  });
}

function exportToPDF(
  transactions: unknown[],
  stats: ExportStats
) {
  return NextResponse.json({
    message: 'PDF export will be generated on client side',
    transactions,
    stats,
  });
}