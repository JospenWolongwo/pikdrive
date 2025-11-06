# 🔐 Payment Environment Variables Configuration Guide

**Complete guide to setting up payment integrations from sandbox to production.**

## 📚 Related Documentation

- [🧪 Sandbox to Production Testing Guide](./SANDBOX_TO_PRODUCTION_GUIDE.md) - Step-by-step testing instructions
- [MTN MOMO Integration](./mtn-momo-integration.md) - MTN-specific details
- [Orange Money Integration](./orange-money-integration.md) - Orange-specific details

## Table of Contents
1. [Quick Start](#quick-start)
2. [MTN Mobile Money (MOMO) Setup](#mtn-mobile-money-momo-setup)
3. [Orange Money Setup](#orange-money-setup)
4. [Application Configuration](#application-configuration)
5. [Switching to Production](#switching-to-production)
6. [Verification & Testing](#verification--testing)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### For First-Time Setup

**🚨 CRITICAL:** Read the [SANDBOX_TO_PRODUCTION_GUIDE.md](./SANDBOX_TO_PRODUCTION_GUIDE.md) first!

**Copy this complete template to `.env.local`:**

```env
# ============================================
# APPLICATION CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ============================================
# MTN MOBILE MONEY - SANDBOX CONFIGURATION
# ============================================
# Get these from: https://momodeveloper.mtn.com
# See "MTN Mobile Money (MOMO) Setup" section below for detailed steps

# Required for Payin (Customer pays you)
MOMO_SUBSCRIPTION_KEY=your_subscription_key
MOMO_API_KEY=your_api_key
MOMO_TARGET_ENVIRONMENT=sandbox
MOMO_CALLBACK_HOST=http://localhost:3000
MOMO_COLLECTION_PRIMARY_KEY=your_primary_key
MOMO_COLLECTION_USER_ID=your_user_id

# Optional: Only if testing Payout (You pay customer)
# MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=
# MOMO_DISBURSEMENT_API_KEY=
# MOMO_DISBURSEMENT_PRIMARY_KEY=
# MOMO_DISBURSEMENT_USER_ID=

# ============================================
# ORANGE MONEY - SANDBOX CONFIGURATION
# ============================================
# Get these from: Contact Orange Money Cameroon support

# Required
ORANGE_MONEY_MERCHANT_ID=your_merchant_id
ORANGE_MONEY_MERCHANT_KEY=your_merchant_key
ORANGE_MONEY_ENVIRONMENT=sandbox
ORANGE_MONEY_NOTIFICATION_URL=http://localhost:3000/api/callbacks/om
ORANGE_MONEY_RETURN_URL=http://localhost:3000/payments/status

# Optional: Mock Orange for development without credentials
USE_MOCK_ORANGE_MONEY=false

# ============================================
# PAYMENT FEES & COMMISSION (Configurable)
# ============================================
# Transaction Fee: Percentage of payment amount (e.g., 1.5% = 1.5)
# Default: 0% (no fee initially to keep costs low)
TRANSACTION_FEE_RATE=0

# Transaction Fee: Fixed amount in XAF (e.g., 50 XAF)
# Default: 0 XAF (no fixed fee initially)
TRANSACTION_FEE_FIXED=0

# Commission: Percentage of payment amount (e.g., 5% = 5)
# Default: 0% (no commission initially to keep costs low)
COMMISSION_RATE=0
```

### ✅ Next Steps

1. **📖 Read**: [SANDBOX_TO_PRODUCTION_GUIDE.md](./SANDBOX_TO_PRODUCTION_GUIDE.md)
2. **🔑 Get credentials**: See sections below
3. **✏️ Fill in template**: Replace all `your_*` placeholders
4. **💾 Save**: As `.env.local` in project root
5. **🧪 Test**: Use sandbox test numbers
6. **✅ Verify**: All tests passing

---

## MTN Mobile Money (MOMO) Setup

### What You Need to Know

**MOMO handles payments in two directions:**
1. **Payin (Collection):** Customer pays you → Money comes IN
2. **Payout (Disbursement):** You pay customer → Money goes OUT

Each requires **separate credentials** from MTN.

---

### Step 1: Create MTN Developer Account

1. Go to [MTN Developer Portal](https://momodeveloper.mtn.com/)
2. Click "Create Account" or "Sign In"
3. Complete email verification
4. **Location:** Select "Cameroon" when prompted

---

### Step 2: Get Sandbox Credentials

#### A. Subscription Key (Required for both Payin & Payout)

1. Login to MTN Developer Portal
2. Go to **"Products & Services"** in sidebar
3. Click **"Collections"** tab
4. Click **"View details"** on the Collection API
5. Click **"Subscribe"** (It's FREE for sandbox)
6. Copy your **Subscription Key** → Save in `.env.local` as `MOMO_SUBSCRIPTION_KEY`

#### B. Payin (Collection) Credentials

1. In Developer Portal, go to **"Manage APIs"** → **"Collections"**
2. Click **"Create API User"**
   - Give it a name like "PikDrive Collections"
   - Click "Create"
3. **Save immediately:**
   - **API User ID** → `MOMO_COLLECTION_USER_ID`
   - **Primary Key** → `MOMO_COLLECTION_PRIMARY_KEY`
   - ⚠️ **You cannot see the Primary Key again!**
4. Generate API Key:
   - Click on your API User
   - Click **"Generate API Key"**
   - Copy the key → `MOMO_API_KEY`
   - ⚠️ **Shown only once! Save it immediately!**

#### C. Payout (Disbursement) Credentials (Optional)

**Repeat steps above for Disbursement API:**

1. Go to **"Products & Services"** → **"Disbursements"**
2. Subscribe to Disbursement API
3. Get Subscription Key → `MOMO_DISBURSEMENT_SUBSCRIPTION_KEY`
4. Create API User → Get User ID and Primary Key
5. Generate API Key → `MOMO_DISBURSEMENT_API_KEY`

---

### Step 3: Configure Environment Variables

```env
# ============================================
# MTN MOMO - PAYIN (Customer pays you)
# ============================================
MOMO_SUBSCRIPTION_KEY=your_subscription_key_from_portal
MOMO_API_KEY=your_generated_api_key_from_portal
MOMO_TARGET_ENVIRONMENT=sandbox          # ← Keep as "sandbox" for testing
MOMO_CALLBACK_HOST=http://localhost:3000  # ← Your app URL
MOMO_COLLECTION_PRIMARY_KEY=your_primary_key_from_portal
MOMO_COLLECTION_USER_ID=your_api_user_id_from_portal

# ============================================
# MTN MOMO - PAYOUT (You pay customer) - OPTIONAL
# ============================================
# Only fill these if testing driver payouts
MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=your_payout_subscription_key
MOMO_DISBURSEMENT_API_KEY=your_payout_api_key
MOMO_DISBURSEMENT_API_USER=your_payout_api_user_id
MOMO_DISBURSEMENT_PRIMARY_KEY=your_payout_primary_key
```

**🔑 Key Points:**
- `MOMO_TARGET_ENVIRONMENT` must be `sandbox` for testing
- `MOMO_CALLBACK_HOST` is where MTN sends payment confirmations
- All credentials come from MTN Developer Portal
- Primary Keys and API Keys are shown **only once** - save immediately!

---

### Step 4: Test in Sandbox

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Use MTN test number:** `237670000000`
   - This is MTN's sandbox test number
   - Works in their sandbox environment only

3. **Make a test payment:**
   - Go to booking page
   - Select MTN Mobile Money
   - Enter test number
   - Click Pay

4. **Approve in MTN Portal:**
   - Go to MTN Developer Portal
   - "Collections" → "Operations"
   - Find your transaction
   - Click "Approve"

5. **Verify:**
   - Check your app - payment should be "completed"
   - Check database - payment record updated
   - Check logs - callback received

---

## Orange Money Setup

### What You Need to Know

Orange Money uses a different authentication system:
- OAuth tokens for authorization
- API credentials for payments
- Different sandbox URLs

---

### Step 1: Request Sandbox Access

Orange Money sandbox requires manual approval:

1. **Contact Orange Money Cameroon:**
   - Email: [Ask your contact for the email]
   - Subject: "Sandbox Environment Access Request"
   - Include: Your business details, use case, expected volume

2. **You'll receive:**
   - OAuth Consumer User & Secret
   - API Username & Password
   - PIN Code
   - Merchant Number
   - Sandbox URLs

---

### Step 2: Configure Environment Variables

```env
# ============================================
# ORANGE MONEY - SANDBOX
# ============================================
ORANGE_MONEY_MERCHANT_ID=your_merchant_id_from_orange
ORANGE_MONEY_MERCHANT_KEY=your_merchant_key_from_orange
ORANGE_MONEY_ENVIRONMENT=sandbox                    # ← Keep as "sandbox"
ORANGE_MONEY_NOTIFICATION_URL=http://localhost:3000/api/callbacks/om
ORANGE_MONEY_RETURN_URL=http://localhost:3000/payments/status

# ============================================
# ORANGE MONEY - ADVANCED (If provided)
# ============================================
# These are usually part of merchant credentials
# Add only if Orange provides separate values:
# ORANGE_MONEY_CONSUMER_USER=
# ORANGE_MONEY_CONSUMER_SECRET=
# ORANGE_MONEY_API_USERNAME=
# ORANGE_MONEY_API_PASSWORD=
# ORANGE_MONEY_PIN_CODE=
# ORANGE_MONEY_MERCHANT_NUMBER=
```

**🔑 Key Points:**
- `ORANGE_MONEY_ENVIRONMENT` must be `sandbox` for testing
- `ORANGE_MONEY_NOTIFICATION_URL` receives payment callbacks
- Credentials come from Orange Money support team

---

### Step 3: Test in Sandbox

1. **Use Orange test numbers:**
   - `237699000001` - Successful payment
   - `237699000002` - Failed payment

2. **Make a test payment:**
   - Select Orange Money as provider
   - Enter test number
   - Complete payment

3. **Verify:**
   - Check payment status in app
   - Check database records
   - Confirm callback received

---

## Application Configuration

### Required for All Environments

```env
# ============================================
# APPLICATION SETTINGS
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000     # Development
# NEXT_PUBLIC_APP_URL=https://yourapp.com     # Production

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ============================================
# OPTIONAL: ADVANCED SETTINGS
# ============================================
USE_MOCK_ORANGE_MONEY=false  # Set to true for development without Orange credentials
```

**🔑 Key Points:**
- `NEXT_PUBLIC_APP_URL` must match where your app runs
- `SUPABASE_*` keys come from Supabase project settings
- Use service role key only in server-side code (never expose to client)

---

## Switching to Production

### ⚠️ CRITICAL: Complete Sandbox Testing First!

**Do NOT switch to production until:**
- ✅ All sandbox tests passing
- ✅ Callbacks working reliably
- ✅ Error handling tested
- ✅ Edge cases covered

See [SANDBOX_TESTING_CHECKLIST.md](./SANDBOX_TESTING_CHECKLIST.md)

---

### Step 1: Request Production Credentials

#### MTN Mobile Money Production

1. **Submit sandbox test results** to MTN:
   - MTN Developer Portal → "Support"
   - Include: Test transactions, success rate, callback logs

2. **Request production access:**
   - Form: "Request Production Access"
   - Provide business details
   - Expected processing volume

3. **Complete compliance check:**
   - Business verification
   - KYC documents
   - Terms & conditions

4. **Receive production credentials:**
   - Different Subscription Key
   - Different API User credentials
   - Production URLs

#### Orange Money Production

1. **Contact Orange Money support**
2. **Provide sandbox test results**
3. **Complete onboarding process**
4. **Receive production credentials**

---

### Step 2: Create Production Environment File

**Create `.env.production`:**
```env
# ============================================
# PRODUCTION CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_URL=https://yourapp.com

# MTN MOMO - PRODUCTION
MOMO_SUBSCRIPTION_KEY=prod_subscription_key_from_mtn
MOMO_API_KEY=prod_api_key_from_mtn
MOMO_TARGET_ENVIRONMENT=production                    # ← Changed!
MOMO_CALLBACK_HOST=https://yourapp.com                # ← Changed!
MOMO_COLLECTION_PRIMARY_KEY=prod_primary_key
MOMO_COLLECTION_USER_ID=prod_api_user_id

# ORANGE MONEY - PRODUCTION
ORANGE_MONEY_MERCHANT_ID=prod_merchant_id
ORANGE_MONEY_MERCHANT_KEY=prod_merchant_key
ORANGE_MONEY_ENVIRONMENT=production                   # ← Changed!
ORANGE_MONEY_NOTIFICATION_URL=https://yourapp.com/api/callbacks/om
ORANGE_MONEY_RETURN_URL=https://yourapp.com/payments/status
```

**🔑 Key Changes:**
- Change `*_ENVIRONMENT` from `sandbox` to `production`
- Change all URLs from `localhost` to production domain
- Use different credentials from production team
- Never commit this file to git!

---

### Step 3: Deploy to Production

1. **Add environment variables to your hosting platform:**
   - **Vercel:** Project Settings → Environment Variables
   - **AWS:** Use Systems Manager Parameter Store
   - **Heroku:** `heroku config:set KEY=value`

2. **Deploy application:**
   ```bash
   npm run build
   npm run deploy
   ```

3. **Test in production:**
   - Make small test payment
   - Verify callback received
   - Check database updates
   - Confirm notifications sent

---

## Verification & Testing

### Quick Verification Script

Create `scripts/verify-env.ts`:

```typescript
#!/usr/bin/env node

const requiredVars = {
  'MOMO_SUBSCRIPTION_KEY': process.env.MOMO_SUBSCRIPTION_KEY,
  'MOMO_API_KEY': process.env.MOMO_API_KEY,
  'MOMO_COLLECTION_PRIMARY_KEY': process.env.MOMO_COLLECTION_PRIMARY_KEY,
  'MOMO_COLLECTION_USER_ID': process.env.MOMO_COLLECTION_USER_ID,
  'ORANGE_MONEY_MERCHANT_ID': process.env.ORANGE_MONEY_MERCHANT_ID,
  'ORANGE_MONEY_MERCHANT_KEY': process.env.ORANGE_MONEY_MERCHANT_KEY,
};

console.log('🔍 Verifying environment variables...\n');

let allPresent = true;
for (const [key, value] of Object.entries(requiredVars)) {
  if (!value || value.length === 0) {
    console.error(`❌ Missing: ${key}`);
    allPresent = false;
  } else {
    console.log(`✅ Present: ${key} (${value.substring(0, 10)}...)`);
  }
}

if (allPresent) {
  console.log('\n✅ All required variables are set!');
  process.exit(0);
} else {
  console.log('\n❌ Some variables are missing. Please check your .env.local');
  process.exit(1);
}
```

Run it:
```bash
npx tsx scripts/verify-env.ts
```

---

## Troubleshooting

### Common Issues

#### "Missing environment variable"

**Problem:** App can't find env variable

**Solutions:**
1. Check `.env.local` exists in project root
2. Restart dev server: `npm run dev`
3. Check file name: `.env.local` not `.env.local.txt`
4. Verify no typos in variable names

---

#### "Invalid API credentials"

**Problem:** MTN/Orange rejects authentication

**Solutions:**
1. Double-check all credential values
2. Copy from developer portal directly (no spaces)
3. Verify environment matches credentials:
   - Sandbox credentials → `sandbox` environment
   - Production credentials → `production` environment

---

#### "Callback not received"

**Problem:** Payment approved but no update in app

**Solutions:**
1. Check `MOMO_CALLBACK_HOST` is correct
2. Verify callback URL is accessible (not localhost)
3. Check server logs for incoming requests
4. Test callback manually with Postman
5. For production, ensure HTTPS is enabled

---

#### "Subscription key expired"

**Problem:** Sandbox subscription expired (happens after 30 days)

**Solutions:**
1. Login to MTN Developer Portal
2. Renew subscription to Collections API
3. Get new subscription key
4. Update `MOMO_SUBSCRIPTION_KEY`

---

#### "Unknown provider"

**Problem:** App doesn't recognize payment provider

**Solutions:**
1. Check `ORANGE_MONEY_ENVIRONMENT` is `sandbox` or `production`
2. Verify provider credentials are set
3. Check phone number prefix matches provider:
   - MTN: `67` prefix
   - Orange: `69` prefix

---

## Environment Variable Reference

### Complete Variable List

| Variable | Required | For | Description |
|----------|----------|-----|-------------|
| **Application** ||||
| `NEXT_PUBLIC_APP_URL` | ✅ | All | Your app's public URL |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | All | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | All | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | All | Supabase service role key |
| **MTN MOMO - Required** ||||
| `MOMO_SUBSCRIPTION_KEY` | ✅ | MTN | From MTN Developer Portal |
| `MOMO_API_KEY` | ✅ | MTN | Generated in portal |
| `MOMO_TARGET_ENVIRONMENT` | ✅ | MTN | `sandbox` or `production` |
| `MOMO_CALLBACK_HOST` | ✅ | MTN | Your app URL for callbacks |
| `MOMO_COLLECTION_PRIMARY_KEY` | ✅ | MTN | From API User creation |
| `MOMO_COLLECTION_USER_ID` | ✅ | MTN | From API User creation |
| **MTN MOMO - Optional** ||||
| `MOMO_DISBURSEMENT_SUBSCRIPTION_KEY` | ⭕ | Payout | If doing payouts |
| `MOMO_DISBURSEMENT_API_KEY` | ⭕ | Payout | If doing payouts |
| `MOMO_DISBURSEMENT_API_USER` | ⭕ | Payout | If doing payouts |
| `MOMO_DISBURSEMENT_PRIMARY_KEY` | ⭕ | Payout | If doing payouts |
| **Orange Money** ||||
| `ORANGE_MONEY_MERCHANT_ID` | ✅ | Orange | From Orange support |
| `ORANGE_MONEY_MERCHANT_KEY` | ✅ | Orange | From Orange support |
| `ORANGE_MONEY_ENVIRONMENT` | ✅ | Orange | `sandbox` or `production` |
| `ORANGE_MONEY_NOTIFICATION_URL` | ✅ | Orange | Callback URL |
| `ORANGE_MONEY_RETURN_URL` | ✅ | Orange | Return URL after payment |
| **Optional** ||||
| `USE_MOCK_ORANGE_MONEY` | ⭕ | Dev | Mock Orange for testing |

---

## Next Steps

1. ✅ **Configure environment variables** using template above
2. 📖 **Read** [SANDBOX_TESTING_CHECKLIST.md](./SANDBOX_TESTING_CHECKLIST.md)
3. 🧪 **Complete** all sandbox tests
4. 🚀 **Deploy** to production when ready

---

## Support Resources

### Documentation
- MTN: [developer.mtn.com](https://developer.mtn.com)
- Orange: [Orange Money Developer Docs](https://developer.orange.com)

### Developer Portals
- MTN: [momodeveloper.mtn.com](https://momodeveloper.mtn.com)
- Orange: [Contact support](https://orange.com/support)

### Community
- MTN Developer Forum: [MTN Community](https://momodeveloper.mtn.com/forum)
- GitHub Issues: [Your repo issues](https://github.com/your-repo)

---

## 🎯 Quick Reference Checklist

### Getting Started (Do this first!)
- [ ] Read [SANDBOX_TO_PRODUCTION_GUIDE.md](./SANDBOX_TO_PRODUCTION_GUIDE.md)
- [ ] Create MTN Developer account
- [ ] Contact Orange Money for sandbox access
- [ ] Copy template above to `.env.local`
- [ ] Fill in all credentials
- [ ] Set up ngrok for local testing
- [ ] Configure callback URLs

### Sandbox Testing (Verify everything works)
- [ ] MTN payin tested with `237670000000`
- [ ] Orange payin tested with `237699000001`
- [ ] Callbacks received and processed
- [ ] Database updates working
- [ ] Notifications sent
- [ ] Error handling tested

### Production Readiness (Before going live)
- [ ] All sandbox tests passing
- [ ] Production credentials received
- [ ] `.env.production` created
- [ ] Environment set to `production`
- [ ] Callback URLs updated
- [ ] Monitoring dashboard ready
- [ ] Rollback plan documented

### Post-Production (First 24 hours)
- [ ] Monitor all transactions
- [ ] Check success rates
- [ ] Watch for errors
- [ ] Verify callbacks received
- [ ] Confirm payouts working

---

**Last Updated:** January 2025  
**Version:** 2.0  
**Status:** ✅ Production Ready

**Need Help?**
1. Start with [SANDBOX_TO_PRODUCTION_GUIDE.md](./SANDBOX_TO_PRODUCTION_GUIDE.md)
2. Check [Troubleshooting](#troubleshooting) section
3. Contact MTN/Orange support
4. Review your logs
