import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WhatsAppService } from '@/lib/whatsapp'
import { formatCurrency } from '@/lib/utils'

export async function POST(request: Request) {
  try {
    const { phone, vouchers } = await request.json()

    if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
      return NextResponse.json({ error: 'No vouchers selected' }, { status: 400 })
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Get company info
    const company = await prisma.company.findFirst()
    const companyName = company?.name || 'SKYLINK'
    const companyPhone = company?.phone || ''

    // Build voucher message
    let message = '🎟️ *Voucher Hotspot Internet*\n\n'
    message += `Halo! Berikut adalah voucher internet Anda:\n\n`
    message += `━━━━━━━━━━━━━━━━━━\n\n`
    
    vouchers.forEach((v: any, idx: number) => {
      message += `*Voucher ${idx + 1}*\n`
      message += `🔑 Code: *${v.code}*\n`
      message += `📦 Package: ${v.profileName}\n`
      message += `💰 Price: ${formatCurrency(v.price)}\n`
      message += `⏳ Active Period: ${v.validity}\n\n`
    })

    message += `━━━━━━━━━━━━━━━━━━\n\n`
    message += `📌 *How to Use:*\n`
    message += `1. Connect to our WiFi hotspot\n`
    message += `2. Open the browser, the login page will appear\\n`
    message += `3. Enter the voucher code\n`
    message += `4. Click Login and enjoy the internet!\n\n`
    message += `⚠️ *Important:*\n`
    message += `• Voucher will be active after first login\n`
    message += `• Please keep the voucher code safe\n`
    message += `• The active period is calculated from the first login\n\n`
    message += `📞 Need help? Contact us: ${companyPhone}\n\n`
    message += `Thank You! 🙏\n${companyName}`

    // Send WhatsApp
    await WhatsAppService.sendMessage({
      phone,
      message
    })

    return NextResponse.json({
      success: true,
      message: 'WhatsApp sent successfully'
    })
  } catch (error) {
    console.error('Send WhatsApp error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
