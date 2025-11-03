# 🧪 Sandbox Testing Checklist for Payment Integration

## Overview

This checklist ensures your payment system is **production-ready** before receiving production credentials. Test everything in sandbox first!

---

## 📋 Pre-Testing Setup

### Step 1: Get Sandbox Credentials

#### MTN Mobile Money Sandbox
1. **Sign up** at [MTN Developer Portal](https://momodeveloper.mtn.com/)
2. **Create Product Subscription:**
   - Login → "Product & Services" → "Collections"
   - Create subscription for "Collection API"
   - Get Subscription Key
3. **Create API User:**
   - Go to "Manage APIs" → "Collection"
   - Create new API User
   - Note: API User ID and Primary Key
4. **Generate API Key:**
   - Click on your API User
   - Generate API Key (save it immediately - shown only once!)
5. **(Optional) For Payout Testing:**
   - Create separate subscription for "Disbursement API"
   - Repeat steps 2-4 for disbursement

#### Orange Money Sandbox
Contact Orange Money Cameroon for sandbox credentials:
- Email: [to be filled]
- Request: Sandbox environment access
- You'll receive:
  - OAuth Consumer User & Secret
  - API Username & Password
  - PIN Code
  - Merchant Number

### Step 2: Configure Environment Variables

Create `.env.local` in your project root:

```env
# ============================================
# APPLICATION CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ============================================
# MTN MOBILE MONEY (MOMO) - SANDBOX
# ============================================

# MOMO Payin (Collection) - Customer pays you
MOMO_SUBSCRIPTION_KEY=your_mtn_subscription_key_here
MOMO_API_KEY=your_generated_api_key_here
MOMO_TARGET_ENVIRONMENT=sandbox
MOMO_CALLBACK_HOST=http://localhost:3000
MOMO_COLLECTION_PRIMARY_KEY=your_primary_key_here
MOMO_COLLECTION_USER_ID=your_api_user_id_here

# (Optional) MOMO Payout - You pay customer
MOMO_DISBURSEMENT_API_USER=your_disbursement_user
MOMO_DISBURSEMENT_API_KEY=your_disbursement_api_key
MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=your_disbursement_subscription_key

# ============================================
# ORANGE MONEY - SANDBOX
# ============================================
ORANGE_MONEY_MERCHANT_ID=your_merchant_id_here
ORANGE_MONEY_MERCHANT_KEY=your_merchant_key_here
ORANGE_MONEY_ENVIRONMENT=sandbox
ORANGE_MONEY_NOTIFICATION_URL=http://localhost:3000/api/callbacks/om
ORANGE_MONEY_RETURN_URL=http://localhost:3000/payments/status

# ============================================
# LEGACY/COMPATIBILITY (Still needed)
# ============================================
USE_MOCK_ORANGE_MONEY=false
```

### Step 3: Verify Configuration

Run this command to check your setup:

```bash
npm run dev
```

Check console for any missing environment variables.

---

## ✅ Testing Checklist

### Phase 1: Configuration Verification ✅

- [ ] **1.1** All environment variables are set
- [ ] **1.2** No missing env var errors in console
- [ ] **1.3** Database connection working
- [ ] **1.4** Supabase authentication working

### Phase 2: MTN MOMO Payin Testing ✅

#### Test 2.1: Create Payment Request
- [ ] Navigate to booking page
- [ ] Select MTN as payment provider
- [ ] Enter sandbox test number: `237670000000`
- [ ] Enter amount (minimum 100 XAF)
- [ ] Click "Pay Now"
- [ ] **Expected:** Payment request sent successfully
- [ ] **Expected:** Status shows "processing"

#### Test 2.2: Approve Payment (Sandbox)
**Manual approval required in MTN Sandbox:**
1. Check your MTN Developer Portal → "Collections" → "Operations"
2. Find pending transaction
3. Click "Approve" on the transaction
4. **Expected:** Callback received
5. **Expected:** Payment status changes to "completed"
6. **Expected:** Booking status updates
7. **Expected:** Notification sent to user

#### Test 2.3: Reject Payment
1. Create another payment
2. In MTN portal, click "Reject"
3. **Expected:** Status changes to "failed"
4. **Expected:** User sees error message

#### Test 2.4: Payment Timeout
1. Create payment
2. Wait 5+ minutes without approving
3. **Expected:** Status shows timeout message

### Phase 3: Orange Money Payin Testing ✅

#### Test 3.1: Create Payment Request
- [ ] Select Orange Money as provider
- [ ] Enter sandbox test number: `237699000001`
- [ ] Enter amount
- [ ] Click "Pay Now"
- [ ] **Expected:** Payment request sent

#### Test 3.2: Approve Payment
**(Similar to MTN - check Orange sandbox portal)**
- [ ] Approve transaction in portal
- [ ] **Expected:** Callback received
- [ ] **Expected:** Payment completed

### Phase 4: Callback Handler Testing ✅

#### Test 4.1: MTN Callback
- [ ] Simulate callback from MTN
- [ ] Send POST to `http://localhost:3000/api/callbacks/momo`
- [ ] Use Postman or curl with payload:
```json
{
  "financialTransactionId": "test123",
  "externalId": "your_payment_id",
  "status": "SUCCESSFUL",
  "amount": 5000,
  "currency": "XAF",
  "payer": { "partyId": "237670000000" },
  "payerMessage": "Test payment"
}
```
- [ ] **Expected:** Payment status updated
- [ ] **Expected:** Booking updated
- [ ] **Expected:** Notification sent

#### Test 4.2: Orange Callback
- [ ] Send POST to `http://localhost:3000/api/callbacks/om`
- [ ] **Expected:** Same behavior as MTN

### Phase 5: Payment Verification Testing ✅

#### Test 5.1: Check Status API
- [ ] Create a payment
- [ ] Call `/api/payments/check-status` with transaction ID
- [ ] **Expected:** Returns current payment status

#### Test 5.2: Cron Job (Auto-Check)
- [ ] Wait for cron job to run (every 5 minutes)
- [ ] **Expected:** Stale payments are checked automatically

### Phase 6: Edge Cases & Error Handling ✅

#### Test 6.1: Invalid Phone Number
- [ ] Enter invalid phone: `12345`
- [ ] **Expected:** Validation error shown
- [ ] **Expected:** No payment created

#### Test 6.2: Insufficient Balance (Simulated)
- [ ] Try payment with amount > available balance
- [ ] **Expected:** Appropriate error message

#### Test 6.3: Network Failure
- [ ] Disable internet during payment
- [ ] **Expected:** Graceful error handling
- [ ] **Expected:** User can retry

#### Test 6.4: Duplicate Payment Prevention
- [ ] Create same payment twice quickly
- [ ] **Expected:** Only one payment created (idempotency)

### Phase 7: Payout Testing ✅

#### Test 7.1: Driver Payout (MTN)
- [ ] Navigate to driver dashboard
- [ ] Request payout
- [ ] Enter amount
- [ ] **Expected:** Payout initiated
- [ ] **Expected:** Status "pending"

#### Test 7.2: Payout Approval
- [ ] Approve in MTN sandbox portal
- [ ] **Expected:** Payout completed

#### Test 7.3: Driver Payout (Orange)
- [ ] Test Orange Money payout
- [ ] **Expected:** Same behavior as MTN

---

## 🔍 Monitoring & Debugging

### Key Logs to Watch

```bash
# Terminal logs
✅ Payment request sent
✅ Payment callback received
✅ Status updated to completed
✅ Notification sent

❌ Error: Missing environment variable
❌ Error: Invalid credentials
❌ Error: Network timeout
```

### Database Queries

Check these tables after each test:

```sql
-- Payments table
SELECT id, status, amount, provider, transaction_id, created_at, updated_at 
FROM payments 
ORDER BY created_at DESC 
LIMIT 10;

-- Bookings table
SELECT id, status, payment_status 
FROM bookings 
WHERE status = 'pending_verification';

-- Payment logs (if exists)
SELECT * FROM payment_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

### Common Issues & Solutions

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| "Missing credentials" | Env vars not loaded | Restart dev server |
| "Invalid API key" | Wrong key format | Regenerate in portal |
| "Callback not received" | Wrong callback URL | Check MOMO_CALLBACK_HOST |
| "Status stuck pending" | Callback failed | Check server logs |
| "Timeout error" | Sandbox slow | Wait longer or retry |

---

## 🚀 Production Readiness Checklist

Before switching to production credentials:

### Code Quality ✅
- [ ] All tests passing
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Linter passing

### Functionality ✅
- [ ] Payin works for both MTN and Orange
- [ ] Payout works for both providers
- [ ] Callbacks working reliably
- [ ] Notifications being sent
- [ ] Error handling graceful

### Configuration ✅
- [ ] Production env vars ready (different file)
- [ ] Callback URLs updated to production
- [ ] Database migrations applied
- [ ] SSL certificate valid

### Documentation ✅
- [ ] Environment variables documented
- [ ] API endpoints documented
- [ ] Error codes documented
- [ ] Deployment guide ready

---

## 📞 Getting Production Credentials

### MTN Mobile Money
1. Complete sandbox testing
2. Submit test results to MTN Developer Portal
3. Request production access
4. Receive production credentials
5. Update `.env.production` file
6. Deploy to production

### Orange Money
1. Contact Orange Money support
2. Provide sandbox test results
3. Complete compliance check
4. Receive production credentials
5. Update environment variables
6. Deploy to production

---

## 🔐 Security Checklist

Before going to production:

- [ ] Never commit `.env.local` to git
- [ ] Use separate env vars for staging/production
- [ ] Rotate API keys regularly
- [ ] Enable HTTPS only
- [ ] Add rate limiting
- [ ] Monitor failed attempts
- [ ] Set up alerting for errors
- [ ] Regular backups of payment data

---

## 📊 Success Metrics

After production deployment, monitor:

- **Payment Success Rate:** > 95%
- **Average Processing Time:** < 2 minutes
- **Callback Delivery:** > 99%
- **Error Rate:** < 1%

---

## 🆘 Support

### MTN Support
- Portal: [momodeveloper.mtn.com](https://momodeveloper.mtn.com)
- Documentation: [developer.mtn.com](https://developer.mtn.com)
- Support: [portal contact form](https://momodeveloper.mtn.com/support)

### Orange Money Support
- Contact: [to be filled]
- Documentation: [Orange Money Docs](https://developer.orange.com)

---

**Last Updated:** January 2025  
**Status:** ✅ Ready for Testing

