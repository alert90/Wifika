// src/lib/timezone.ts
import {
  format,
  formatDistanceToNow,
  differenceInDays,
  addDays,
  startOfDay,
  endOfDay,
  isBefore,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { enUS as localeEn } from 'date-fns/locale';

export const NAIROBI_TIMEZONE = 'Africa/Nairobi';
export const NAIROBI_OFFSET = '+03:00';

export function toNairobi(utc: Date | string | null | undefined): Date | null {
  if (!utc) return null;
  try {
    const date = typeof utc === 'string' ? new Date(utc) : utc;
    return toZonedTime(date, NAIROBI_TIMEZONE);
  } catch (error) {
    console.error('toNairobi error:', error);
    return null;
  }
}

export function toUTCFromNairobi(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return fromZonedTime(d, NAIROBI_TIMEZONE);
}

export function formatNairobi(
  utc: Date | string | null | undefined,
  formatStr: string = 'dd MMM yyyy HH:mm'
): string {
  const nairobi = toNairobi(utc);
  if (!nairobi) return '-';
  try {
    return format(nairobi, formatStr, { locale: localeEn });
  } catch (error) {
    console.error('formatNairobi error:', error);
    return '-';
  }
}

export function relativeNairobi(utc: Date | string | null | undefined): string {
  const nairobi = toNairobi(utc);
  if (!nairobi) return '-';
  try {
    return formatDistanceToNow(nairobi, { addSuffix: true, locale: localeEn });
  } catch (error) {
    console.error('relativeNairobi error:', error);
    return '-';
  }
}

export function isExpiredNairobi(utc: Date | string | null | undefined): boolean {
  const nairobi = toNairobi(utc);
  if (!nairobi) return false;
  return isBefore(nairobi, nowNairobi());
}

export function daysUntilExpiryNairobi(
  utc: Date | string | null | undefined
): number | null {
  const nairobi = toNairobi(utc);
  if (!nairobi) return null;
  return differenceInDays(nairobi, new Date());
}

export function nowNairobi(): Date {
  return toZonedTime(new Date(), NAIROBI_TIMEZONE);
}

export function addDaysToUTC(utc: Date | string, days: number): Date {
  const date = typeof utc === 'string' ? new Date(utc) : utc;
  return addDays(date, days);
}

export function startOfDayNairobiToUTC(date: Date | string = new Date()): Date {
  const nairobi = toNairobi(date);
  if (!nairobi) return new Date();
  return toUTCFromNairobi(startOfDay(nairobi));
}

export function endOfDayNairobiToUTC(date: Date | string = new Date()): Date {
  const nairobi = toNairobi(date);
  if (!nairobi) return new Date();
  return toUTCFromNairobi(endOfDay(nairobi));
}

export function toDatetimeLocalNairobi(utc: Date | string | null | undefined): string {
  if (!utc) return '';
  return formatNairobi(utc, "yyyy-MM-dd'T'HH:mm");
}

export function fromDatetimeLocalNairobi(datetimeLocal: string): Date {
  return toUTCFromNairobi(new Date(datetimeLocal));
}

export function getTimezoneInfo() {
  return {
    timezone: NAIROBI_TIMEZONE,
    offset: NAIROBI_OFFSET,
    name: 'East Africa Time (EAT)',
    abbreviation: 'EAT',
  };
}

export function formatDateWithStatusNairobi(date: Date | string | null) {
  if (!date) return { text: '-', color: 'gray' as const };
  const days = daysUntilExpiryNairobi(date);
  if (days === null) return { text: '-', color: 'gray' as const };
  const formatted = formatNairobi(date, 'dd MMM yyyy');
  if (days < 0) return { text: `${formatted} (Late ${Math.abs(days)} days)`, color: 'red' as const };
  if (days === 0) return { text: `${formatted} (Today!)`, color: 'orange' as const };
  if (days <= 3) return { text: `${formatted} (${days} days left)`, color: 'yellow' as const };
  return { text: formatted, color: 'green' as const };
}

// Backward-compat aliases
export const daysUntilExpiry = daysUntilExpiryNairobi;