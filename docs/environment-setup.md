# Environment Setup Guide

## Quick Start

1. Copy the example file:

```bash
cp .env.local.example .env.local
```

2. Fill in the required values (marked `[REQUIRED]` in the file).

---

## Required Variables

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=         # Supabase service role key (server-side only)
```

Get these from: **Supabase Dashboard > Project Settings > API**

### App Configuration
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000   # Your app URL (update for production)
```

---

## Payment Providers

### PawaPay (Primary - Recommended)
```env
USE_PAWAPAY=true
PAWAPAY_API_TOKEN=
PAWAPAY_BASE_URL=https://api.sandbox.pawapay.cloud
PAWAPAY_ENVIRONMENT=sandbox
```

When `USE_PAWAPAY=true`, all payments route through PawaPay (supports both MTN and Orange Money).

### MTN MoMo (Direct - Fallback)
Only needed if `USE_PAWAPAY=false`:
```env
MOMO_SUBSCRIPTION_KEY=
MOMO_API_KEY=
MOMO_TARGET_ENVIRONMENT=sandbox
MOMO_CALLBACK_HOST=
MOMO_COLLECTION_PRIMARY_KEY=
MOMO_COLLECTION_USER_ID=
MOMO_DISBURSEMENT_API_USER=
MOMO_DISBURSEMENT_API_KEY=
MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=
```

### Orange Money (Direct - Fallback)
Only needed if `USE_PAWAPAY=false`:
```env
ORANGE_MONEY_MERCHANT_ID=
ORANGE_MONEY_MERCHANT_KEY=
ORANGE_MONEY_ENVIRONMENT=sandbox
```

---

## Notifications

### WhatsApp Business API
```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
META_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=pikdrive_verify
WHATSAPP_API_VERSION=v24.0
```

Get these from: **Meta Business Manager > WhatsApp > API Setup**

### OneSignal (Push Notifications)
```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=
NEXT_PUBLIC_ONESIGNAL_API_KEY=
NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID=
```

Get these from: **OneSignal Dashboard > Settings > Keys & IDs**

---

## Cron Jobs

```env
CRON_SECRET=    # Secret for securing cron endpoints (vercel.json)
```

---

## Sandbox Testing

```env
SANDBOX_PAWAPAY_TEST_PHONE=    # Test phone for PawaPay sandbox payouts
SANDBOX_MTN_TEST_PHONE=        # Test phone for MTN sandbox payouts
```

---

## Security Notes

- Never commit `.env.local` to version control
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — keep it server-side only
- Use different credentials for development and production
- See `.env.local.example` for the complete variable list

---
Last Updated: February 2026
