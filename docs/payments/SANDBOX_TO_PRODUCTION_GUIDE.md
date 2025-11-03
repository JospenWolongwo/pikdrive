# 🧪 Sandbox to Production Testing Guide

**Complete step-by-step guide to testing payment integration from sandbox to production.**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Sandbox Setup](#sandbox-setup)
3. [Testing Payin (Customer Payments)](#testing-payin-customer-payments)
4. [Testing Payout (Driver Payments)](#testing-payout-driver-payments)
5. [Production Readiness](#production-readiness)
6. [Production Deployment](#production-deployment)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## 1️⃣ Prerequisites

### Required Accounts

#### MTN Mobile Money
- [ ] MTN Developer Portal account: https://momodeveloper.mtn.com
- [ ] Sandbox collection API access
- [ ] (Optional) Sandbox disbursement API access

#### Orange Money
- [ ] Contact Orange Money Cameroon for sandbox access
- [ ] Consumer credentials
- [ ] API credentials

### Application Requirements
- [ ] Supabase project setup
- [ ] Callback URLs configured (must be publicly accessible)
- [ ] Environment variables configured

---

## 2️⃣ Sandbox Setup

### Step 1: Configure Environment Variables

Create `.env.local` file:

```env
# ==========================================
# MTN MOBILE MONEY CONFIGURATION (SANDBOX)
# ==========================================

# Base URL - Sandbox (change to production when ready)
DIRECT_MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com
# DIRECT_MOMO_BASE_URL=https://api.mtn.cm  # Production (commented out)

# Collection API (Payin) - Get from MTN Developer Portal
DIRECT_MOMO_API_USER=your_sandbox_api_user
DIRECT_MOMO_API_KEY=your_sandbox_api_key
DIRECT_MOMO_APIM_SUBSCRIPTION_KEY=your_sandbox_subscription_key

# Primary Key (for webhook signature validation)
DIRECT_MOMO_COLLECTION_PRIMARY_KEY=your_sandbox_primary_key
DIRECT_MOMO_COLLECTION_USER_ID=your_sandbox_collection_user_id

# Callback URLs - Use ngrok or similar for local testing
DIRECT_MOMO_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/callbacks/momo
DIRECT_MOMO_PAYOUT_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/callbacks/momo-payout

# Environment setting
DIRECT_MOMO_TARGET_ENVIRONMENT=sandbox  # or "production"

# Optional: Disbursement API (Payout) - Separate credentials needed
DIRECT_MOMO_API_USER_DISBURSMENT=your_sandbox_payout_api_user
DIRECT_MOMO_API_KEY_DISBURSMENT=your_sandbox_payout_api_key
DIRECT_MOMO_APIM_PAY_OUT_SUBSCRIPTION_KEY=your_sandbox_payout_subscription_key

# ==========================================
# ORANGE MONEY CONFIGURATION (SANDBOX)
# ==========================================

# Base URLs - Sandbox (change to production when ready)
DIRECT_OM_TOKEN_URL=https://api.orange-sonatel.com/oauth/
# DIRECT_OM_TOKEN_URL=https://api.orange.cm/oauth/  # Production (commented out)

DIRECT_OM_BASE_URL=https://api.orange-sonatel.com/
# DIRECT_OM_BASE_URL=https://api.orange.cm/  # Production (commented out)

# Consumer Credentials (OAuth)
DIRECT_OM_CONSUMER_USER=your_om_consumer_user
DIRECT_OM_CONSUMER_SECRET=your_om_consumer_secret

# API Credentials
DIRECT_OM_API_USERNAME=your_om_api_username
DIRECT_OM_API_PASSWORD=your_om_api_password
DIRECT_OM_PIN_CODE=your_om_pin
DIRECT_OM_MERCHAND_NUMBER=your_merchant_number

# Callback URL
DIRECT_OM_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/callbacks/om

# Environment setting
ORANGE_MONEY_ENVIRONMENT=sandbox  # or "production"

# ==========================================
# APP CONFIGURATION
# ==========================================

# Your app URL (for callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# NEXT_PUBLIC_APP_URL=https://pickdrive.com  # Production (commented out)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 2: Set Up ngrok for Local Testing

Webhooks require publicly accessible URLs. Use ngrok:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use this in your DIRECT_MOMO_CALLBACK_URL and DIRECT_OM_CALLBACK_URL
```

**⚠️ IMPORTANT:** 
- Update callback URLs in your provider dashboards
- Update `DIRECT_MOMO_CALLBACK_URL` and `DIRECT_OM_CALLBACK_URL` in `.env.local`
- Restart your dev server after changing URLs

---

## 3️⃣ Testing Payin (Customer Payments)

### Test Flow Overview

```
1. User clicks "Book Ride"
2. User selects MTN or Orange
3. User enters phone number
4. Payment request sent to provider
5. Provider pushes notification to user's phone
6. User approves payment
7. Provider sends webhook to our callback
8. Database updated → Booking confirmed
```

### MTN MOMO Payin Testing

#### Test Scenario 1: Successful Payment

**Setup:**
- MTN Developer Portal → Use test number: `237670000000`
- Amount: Any amount between 100-500,000 XAF

**Steps:**
1. Go to your app: http://localhost:3000
2. Create a booking (e.g., Yaounde → Douala)
3. Select "MTN Mobile Money"
4. Enter phone: `237670000000` (MTN test number)
5. Click "Pay"
6. **Expected:** Payment auto-approves (sandbox behavior)
7. Check browser console for logs
8. Check database for payment status

**Verification Checklist:**
- [ ] Console shows: "✅ MOMO Payin callback received"
- [ ] Payment status in DB: `completed`
- [ ] Booking status: `confirmed`
- [ ] Receipt generated
- [ ] Notifications sent (driver + passenger)

#### Test Scenario 2: Failed Payment

**Setup:**
- Use test number: `237670000001`
- This number will simulate a failed payment

**Steps:**
Same as above, but payment should fail.

**Verification:**
- [ ] Payment status: `failed`
- [ ] Booking status: `pending`
- [ ] User sees error message

### Orange Money Payin Testing

#### Test Scenario 1: Successful Payment

**Setup:**
- Contact Orange for test numbers (typically `237699000001`, `237699000002`)

**Steps:**
1. Same as MTN testing above
2. Select "Orange Money"
3. Enter Orange test number
4. Complete payment

**Verification:**
Same as MTN success scenario

---

## 4️⃣ Testing Payout (Driver Payments)

### Test Flow Overview

```
1. Ride completes (mark ride as completed in database)
2. System calculates driver earnings
3. Payout initiated to driver's phone
4. Provider processes payout
5. Provider sends webhook to our callback
6. Payout record updated in database
```

### MTN MOMO Payout Testing

**Setup:**
- Enable disbursement API in MTN Developer Portal
- Use disbursement test number: `237670000000`

**Steps:**
1. Mark a completed ride in admin panel
2. Trigger manual payout (or wait for automated payout)
3. Check console for payout initiation
4. Verify payout callback received

**Verification:**
- [ ] Payout status: `completed`
- [ ] Driver balance updated
- [ ] Transaction recorded in database

### Orange Money Payout Testing

**Similar steps as MTN**, use Orange test number.

---

## 5️⃣ Production Readiness

### Checklist Before Going Live

#### Configuration
- [ ] All sandbox credentials replaced with production
- [ ] Base URLs changed to production endpoints
- [ ] Callback URLs point to production domain
- [ ] `TARGET_ENVIRONMENT=sandbox` changed to `production`
- [ ] No hardcoded test phone numbers in code

#### Security
- [ ] Environment variables secured in production platform
- [ ] `.env.local` not committed to git
- [ ] Webhook signature validation enabled
- [ ] HTTPS enforced on all callbacks

#### Testing
- [ ] All payin scenarios tested in sandbox
- [ ] All payout scenarios tested in sandbox
- [ ] Error handling tested
- [ ] Callback reliability tested
- [ ] Database integrity verified

#### Monitoring
- [ ] Error logging configured
- [ ] Payment status dashboard ready
- [ ] Alert system for failed payments
- [ ] Webhook monitoring in place

#### Documentation
- [ ] Production credentials documented securely
- [ ] Runbooks for common issues
- [ ] Rollback plan documented

---

## 6️⃣ Production Deployment

### Step-by-Step Deployment

#### Step 1: Update Environment Variables

In your production environment (Vercel, AWS, etc.):

```env
# MTN PRODUCTION
DIRECT_MOMO_BASE_URL=https://api.mtn.cm
DIRECT_MOMO_API_USER=prod_api_user
DIRECT_MOMO_API_KEY=prod_api_key
DIRECT_MOMO_APIM_SUBSCRIPTION_KEY=prod_subscription_key
DIRECT_MOMO_COLLECTION_PRIMARY_KEY=prod_primary_key
DIRECT_MOMO_COLLECTION_USER_ID=prod_user_id
DIRECT_MOMO_CALLBACK_URL=https://pickdrive.com/api/callbacks/momo
DIRECT_MOMO_TARGET_ENVIRONMENT=production

# Orange PRODUCTION
DIRECT_OM_TOKEN_URL=https://api.orange.cm/oauth/
DIRECT_OM_BASE_URL=https://api.orange.cm/
DIRECT_OM_CONSUMER_USER=prod_consumer_user
DIRECT_OM_CONSUMER_SECRET=prod_consumer_secret
DIRECT_OM_API_USERNAME=prod_api_username
DIRECT_OM_API_PASSWORD=prod_api_password
DIRECT_OM_PIN_CODE=prod_pin
DIRECT_OM_MERCHAND_NUMBER=prod_merchant_number
DIRECT_OM_CALLBACK_URL=https://pickdrive.com/api/callbacks/om
ORANGE_MONEY_ENVIRONMENT=production

# APP PRODUCTION
NEXT_PUBLIC_APP_URL=https://pickdrive.com
```

#### Step 2: Configure Production Callbacks

**MTN Developer Portal:**
1. Log in → Products → Your Collection API
2. Settings → Callback URL
3. Set: `https://pickdrive.com/api/callbacks/momo`
4. Save

**Orange Money:**
1. Contact Orange support
2. Provide callback URL: `https://pickdrive.com/api/callbacks/om`
3. Wait for confirmation

#### Step 3: Deploy Code

```bash
# Build and deploy
npm run build
vercel deploy --prod  # or your deployment command

# Verify deployment
curl https://pickdrive.com/api/health
```

#### Step 4: Test Production with Real Phone

**⚠️ WARNING:** This will use real money!

1. Test with **small amount** (100 XAF)
2. Use **real MTN/Orange number**
3. Monitor logs carefully
4. Verify callback received
5. Check database

#### Step 5: Monitor First 24 Hours

- [ ] All payments processing correctly
- [ ] No callback failures
- [ ] No timeout errors
- [ ] Driver payouts working
- [ ] Customer support responding

---

## 7️⃣ Monitoring & Troubleshooting

### Key Metrics to Monitor

#### Payment Success Rate
```sql
-- Check payin success rate (last 24h)
SELECT 
  provider,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM payments
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;
```

#### Average Processing Time
```sql
-- Average time from pending to completed
SELECT 
  provider,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
FROM payments
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;
```

### Common Issues & Solutions

#### Issue 1: Callbacks Not Received

**Symptoms:**
- Payment created but never completes
- Status stuck on `processing`

**Diagnosis:**
```bash
# Check callback endpoint is accessible
curl -X POST https://pickdrive.com/api/callbacks/momo \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check server logs
vercel logs --app pickdrive --follow
```

**Solutions:**
1. Verify callback URL in provider dashboard
2. Check ngrok/proxy is running (if in dev)
3. Verify HTTPS certificate
4. Check firewall rules
5. Review provider logs for delivery failures

#### Issue 2: Invalid Signature

**Symptoms:**
- Error: "Invalid webhook signature"
- 401 responses in logs

**Solutions:**
1. Verify `PRIMARY_KEY` matches provider dashboard
2. Check encoding (must be hex)
3. Review signature validation code
4. Test with provider's webhook simulator

#### Issue 3: Payment Timeout

**Symptoms:**
- Payment created but user never receives request
- No callback received

**Diagnosis:**
1. Check provider status page
2. Verify phone number format
3. Check account balance (for payouts)
4. Review API rate limits

**Solutions:**
1. Retry payment
2. Validate phone format: `237XXXXXXXXX`
3. Check provider API status
4. Implement polling as fallback

### Logging Best Practices

**What to Log:**
```typescript
console.log('📥 Callback received:', {
  provider: 'mtn',
  externalId: 'payment-123',
  status: 'SUCCESSFUL',
  timestamp: new Date().toISOString()
});

console.error('❌ Payment failed:', {
  provider: 'orange',
  error: error.message,
  statusCode: 400,
  requestId: 'req-123'
});
```

**What NOT to Log:**
- ❌ Full payment amounts (PII)
- ❌ Customer phone numbers (GDPR)
- ❌ API keys
- ❌ Passwords

### Alert Rules

Set up alerts for:
- Payment failure rate > 10%
- Callback error rate > 5%
- Average processing time > 5 minutes
- API response time > 2 seconds

---

## 📚 Additional Resources

### MTN MOMO
- [MTN Developer Portal](https://momodeveloper.mtn.com)
- [Collection API Docs](https://momodeveloper.mtn.com/docs)
- [Sandbox Guide](https://momodeveloper.mtn.com/sandbox)

### Orange Money
- Contact Orange support for docs
- API reference available from Orange

### Tools
- [ngrok](https://ngrok.com) - Local webhook testing
- [Postman](https://postman.com) - API testing
- [Sentry](https://sentry.io) - Error tracking

---

## ✅ Final Verification

Before marking as production-ready:

- [ ] All sandbox tests passed
- [ ] Production credentials configured
- [ ] Callback URLs working
- [ ] Successfully tested with real phone (+ small amount)
- [ ] Monitoring dashboard active
- [ ] Rollback plan documented
- [ ] Team trained on troubleshooting

**🎉 Congratulations! Your payment system is production-ready!**

---

**Need Help?**
- Check logs: `vercel logs --app your-app`
- Review provider documentation
- Contact MTN/Orange support
- Open issue in repository

**Last Updated:** January 2025
**Version:** 1.0


