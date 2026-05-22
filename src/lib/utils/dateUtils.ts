/**
 * DEPRECATED: This file is replaced by @/lib/timezone.ts
 * All dates in database are stored as UTC
 * Use timezone.ts for proper UTC ↔ WIB conversion
 * 
 * This file is kept for backward compatibility
 */

import { toNairobi, formatNairobi, daysUntilExpiry, relativeNairobi, nowNairobi } from '@/lib/timezone'

/**
 * Format datetime string (UTC from DB) to WIB display
 * Format: dd/MM/yyyy HH:mm:ss
 */
export function formattoNairobi(dateStr: string | Date): string {
  return formatNairobi(dateStr, 'dd/MM/yyyy HH:mm:ss')
}

/**
 * Format date only (UTC from DB) to WIB display
 * Format: dd/MM/yyyy
 */
export function formatDateOnly(dateStr: string | Date): string {
  return formatNairobi(dateStr, 'dd/MM/yyyy')
}

/**
 * Format time only (UTC from DB) to WIB display
 * Format: HH:mm:ss
 */
export function formatTimeOnly(dateStr: string | Date): string {
  return formatNairobi(dateStr, 'HH:mm:ss')
}

/**
 * Calculate time left until expiry
 * Returns human-readable string like "2h 30m left"
 */
export function calculateTimeLeft(expiresAtStr: string | Date): string {
  if (!expiresAtStr) return '-'
  
  try {
    const expiresWIB = toNairobi(expiresAtStr)
    if (!expiresWIB) return '-'
    
    const now = nowNairobi()
    const diff = Math.max(0, Math.floor((expiresWIB.getTime() - now.getTime()) / 1000))
    
    if (diff === 0) return 'Expired'
    
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    const seconds = diff % 60
    
    if (hours > 0) return `${hours}h ${minutes}m left`
    if (minutes > 0) return `${minutes}m ${seconds}s left`
    return `${seconds}s left`
  } catch {
    return 'Invalid'
  }
}

/**
 * Get current time in WIB
 */
export function nowInWIB(): Date {
  return nowNairobi()
}

/**
 * Format relative time (e.g., "2 hours ago")
 * Uses date-fns relativeNairobi which supports Indonesian locale
 */
export function formatRelativeTime(dateStr: string | Date): string {
  return relativeNairobi(dateStr)
}
