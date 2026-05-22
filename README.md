# SKYLINK - Billing System for WISP
A modern, full-stack ISP billing and network management platform engineered for WISP, delivering accurate Nairobi (EAT, UTC+3) time synchronization, integrated M-Pesa payment workflows, automated WhatsApp & SMS notification pipelines, comprehensive PPPoE and Hotspot management, and multi-tenant billing and subscriber management for efficient ISP operations.

## 🎯 Key Features

- ✅ Proper Nairobi Timezone Handling – All dates stored in UTC, displayed in EAT
- 🎨 Premium UI – Mobile-first responsive design with dark mode
- ⚡ Modern Stack – Next.js 15, TypeScript, Tailwind CSS, Prisma
- 🔐 Secure – Built-in authentication structure
- 📱 SPA Experience – Fast, smooth navigation without page reloads
- 💳 M-Pesa Integration – STK Push and payment callbacks
- 📩 Notifications – WhatsApp & SMS alerts for invoices, payments, and events

## 🚀 Tech Stack

- Framework: Next.js 15 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Database: MySQL with Prisma ORM
- Icons: Lucide React
- Date Handling: date-fns with timezone support
- Messaging: WhatsApp & SMS APIs
- Payments: M-Pesa API

## 📋 Admin Panel Modules

- Dashboard – Overview with stats and real-time data
- PPPoE Management – Users and profiles
- Hotspot Management – Vouchers, profiles, and templates
- Agent Management – Reseller accounts
- Invoices – Billing and payment tracking
- Payment Gateway – M-Pesa, Midtrans, Xendit
- Keuangan – Financial reporting
- Sessions – Active connections monitoring
- WhatsApp & SMS Integration – Automated notifications
- Network Management – Router/NAS configuration
- Network Map – Visual network topology
- Settings – Company profile, cron jobs, GenieACS

## 🕐 Timezone Handling (Nairobi/EAT)

- Database Storage (UTC) – All dates stored in MySQL as UTC; Prisma handles automatically
- Display (EAT) – Frontend converts UTC to Nairobi/EAT using `date-fns-tz`
  - `toEAT()` – Convert UTC to EAT for display
  - `toUTC()` – Convert EAT to UTC for storage
  - `formatEAT()` – Format dates in EAT
  - `isExpired()` – Check expiry in EAT context

## 🌍 Environment Variables

```bash
TZ="Africa/Nairobi"
NEXT_PUBLIC_TIMEZONE="Africa/Nairobi"

---


Made with ❤️ by Cyberwiz

