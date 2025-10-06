# Payment Debugging Guide

## 🎯 Overview

This guide helps you debug payment issues in the PikDrive platform. It covers common problems, diagnostic tools, and resolution strategies.

---

## 🔴 Common Issues & Solutions

### Issue 1: "Payment not found" (404 Error)

**Symptoms:**
```
GET /rest/v1/payments?transaction_id=eq.xxx → 406 PGRST116
POST /api/payments/check-status → 404 Payment not found
```

**Root Causes:**
1. Transaction ID not yet saved to database (race condition)
2. Payment created but update failed
3. Wrong transaction ID being searched

**Solutions:**

✅ **Implemented Resilience:**
- Payment service now uses `maybeSingle()` instead of `single()` to avoid 406 errors
- Multi-strategy fallback queries:
  1. Search by `transaction_id`
  2. If not found, search by `booking_id`
  3. If still not found, check recent pending payments

✅ **Frontend Changes:**
- Pass `bookingId` along with `transactionId` in check-status calls
- Implement retry logic with exponential backoff

**Manual Fix:**
```sql
-- Check if payment exists
SELECT id, transaction_id, status, booking_id, created_at 
FROM payments 
ORDER BY created_at DESC 
LIMIT 10;

-- Update missing transaction_id
UPDATE payments 
SET transaction_id = 'actual-transaction-id'
WHERE id = 'payment-id';
```

---

### Issue 2: Type Mismatch (provider vs payment_method)

**Symptoms:**
```
Error: Column "provider" violates enum constraint
```

**Root Cause:**
Database uses enum `('mtn', 'orange')` but TypeScript used `('momo', 'card', 'cash', 'bank_transfer')`

**Solution:**
✅ Fixed in `types/payment.ts`:
```typescript
export type PaymentMethod = 
  | 'mtn'      // ✅ Matches database enum
  | 'orange'   // ✅ Matches database enum
  | 'card'
  | 'cash'
  | 'bank_transfer';
```

---

### Issue 3: Race Conditions in Payment Creation

**Symptoms:**
- Payment created but status check fails immediately
- Transaction ID null when checking status

**Root Cause:**
Frontend polls status before transaction_id is saved:
```
1. Create payment (transaction_id = null)
2. Call provider API → get transaction_id
3. Update payment with transaction_id
4. ⚠️ Frontend checks status HERE (too early!)
```

**Solutions:**

✅ **Backend:** Smart fallback query in `getPaymentByTransactionId()`
```typescript
// 1. Try exact match
// 2. If not found, search recent pending payments (last 5 minutes)
// 3. Return most recent as fallback
```

✅ **Frontend:** Add initial delay before polling
```typescript
// Wait 2 seconds before first status check
setTimeout(() => startPolling(), 2000);
```

---

## 🛠 Diagnostic Tools

### 1. Payment Simulation API

Test payment flows without actual provider API calls.

**Endpoint:** `POST /api/payments/simulate`

**Usage:**
```bash
curl -X POST http://localhost:3000/api/payments/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "abc-123",
    "newStatus": "completed"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "transactionId": "abc-123",
    "oldStatus": "processing",
    "newStatus": "completed",
    "message": "Payment status simulated"
  }
}
```

**Valid Status Transitions:**
- `pending` → `processing`, `failed`, `cancelled`
- `processing` → `completed`, `failed`
- `completed` → `refunded`
- `failed`, `cancelled`, `refunded` → (no further transitions)

---

### 2. Enhanced Logging

All payment operations now use structured logging with tags:

```typescript
console.log('🔍 [CHECK-STATUS] Starting payment status check:', { 
  transactionId, 
  provider, 
  bookingId,
  timestamp 
});
```

**Log Tags:**
- `[CHECK-STATUS]` - Status check operations
- `[CREATE-PAYMENT]` - Payment creation
- `[SIMULATE]` - Simulation API
- `[ORCHESTRATE]` - Payment orchestration

**Monitoring Logs:**
```bash
# Development
npm run dev | grep "CHECK-STATUS"

# Production (Vercel)
vercel logs --follow | grep "payment"
```

---

### 3. Database Inspection Queries

**Check Recent Payments:**
```sql
SELECT 
  id,
  booking_id,
  transaction_id,
  status,
  provider,
  amount,
  created_at,
  updated_at
FROM payments 
ORDER BY created_at DESC 
LIMIT 20;
```

**Find Orphaned Payments:**
```sql
-- Payments without transaction_id
SELECT * FROM payments 
WHERE transaction_id IS NULL 
  AND status != 'pending'
  AND created_at > NOW() - INTERVAL '1 hour';
```

**Check Payment State Transitions:**
```sql
-- Query payment_event_queue for audit trail
SELECT 
  p.id,
  p.status,
  peq.event_type,
  peq.status as queue_status,
  peq.created_at
FROM payments p
LEFT JOIN payment_event_queue peq ON p.id = peq.payment_id
WHERE p.id = 'payment-id'
ORDER BY peq.created_at DESC;
```

---

## 🧪 Testing Payment Flows

### Test Scenario 1: Successful Payment

1. Create payment:
```bash
POST /api/payments/create
{
  "bookingId": "booking-123",
  "amount": 5000,
  "provider": "mtn",
  "phoneNumber": "237690000000"
}
```

2. Wait 2 seconds for transaction_id to be saved

3. Simulate success:
```bash
POST /api/payments/simulate
{
  "transactionId": "returned-from-step-1",
  "newStatus": "completed"
}
```

4. Verify:
- Payment status = `completed`
- Booking status = `pending_verification`
- Receipt created
- Notifications sent

---

### Test Scenario 2: Failed Payment

1. Create payment (same as above)

2. Simulate failure:
```bash
POST /api/payments/simulate
{
  "transactionId": "xxx",
  "newStatus": "failed"
}
```

3. Verify:
- Payment status = `failed`
- Booking status = `cancelled`
- Seats restored to ride
- Failure notification sent

---

### Test Scenario 3: Race Condition Handling

1. Create payment
2. **Immediately** check status (before transaction_id saved):
```bash
POST /api/payments/check-status
{
  "transactionId": "xxx",
  "provider": "mtn",
  "bookingId": "booking-123"  # ✅ Fallback identifier
}
```

3. Should receive:
```json
{
  "success": true,
  "data": {
    "status": "processing",
    "message": "Payment is being processed"
  }
}
```

---

## 🚨 Error Response Guide

### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required fields: transactionId, provider"
}
```
**Fix:** Include all required fields in request body.

---

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```
**Fix:** Ensure user is authenticated. Check JWT token.

---

### 404 Payment Not Found
```json
{
  "success": false,
  "error": "Payment not found",
  "debug": {
    "searchCriteria": { "transactionId": "xxx", "bookingId": "yyy" },
    "recentPaymentsCount": 3,
    "hint": "Payment might not exist or transaction_id not yet saved"
  }
}
```
**Fix:** 
- Check if payment exists in database
- Wait 2-3 seconds and retry
- Verify transaction_id is correct

---

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to check payment status",
  "details": "stack trace (development only)"
}
```
**Fix:** Check server logs for full error details.

---

## 📊 Performance & Scalability

### Database Indexes

Ensure these indexes exist for optimal query performance:

```sql
CREATE INDEX IF NOT EXISTS payments_transaction_id_idx 
  ON payments(transaction_id);

CREATE INDEX IF NOT EXISTS payments_booking_id_idx 
  ON payments(booking_id);

CREATE INDEX IF NOT EXISTS payments_status_created_idx 
  ON payments(status, created_at);
```

### Query Optimization

**❌ Before (Slow):**
```sql
SELECT * FROM payments WHERE transaction_id = 'xxx';
-- Full table scan if no index
```

**✅ After (Fast):**
```sql
-- Index scan on payments_transaction_id_idx
SELECT * FROM payments WHERE transaction_id = 'xxx';
```

---

## 🔒 Security Considerations

### 1. Rate Limiting

Implement rate limiting on status check endpoint:

```typescript
// TODO: Add rate limiting middleware
// Max 30 requests per minute per user
```

### 2. Idempotency

All payment operations use idempotency keys:

```typescript
const idempotencyKey = `payment_${bookingId}_${userId}`;
```

This prevents duplicate payments if request is retried.

### 3. Authorization

Payment status checks verify:
- User is authenticated
- User owns the payment (via booking)

---

## 📈 Monitoring & Alerts

### Key Metrics to Track

1. **Payment Success Rate**
   ```sql
   SELECT 
     COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) * 100 as success_rate
   FROM payments
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

2. **Average Processing Time**
   ```sql
   SELECT 
     AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
   FROM payments
   WHERE status = 'completed'
     AND created_at > NOW() - INTERVAL '24 hours';
   ```

3. **Stuck Payments** (processing > 10 minutes)
   ```sql
   SELECT * FROM payments
   WHERE status = 'processing'
     AND created_at < NOW() - INTERVAL '10 minutes';
   ```

### Recommended Alerts

- ⚠️ Payment success rate drops below 90%
- ⚠️ More than 5 stuck payments
- ⚠️ Error rate exceeds 5%

---

## 🔄 State Machine Diagram

```
┌─────────┐
│ pending │
└────┬────┘
     │
     ├──────────► cancelled
     │
     ▼
┌────────────┐
│ processing │
└────┬───────┘
     │
     ├──────────► failed
     │
     ▼
┌───────────┐
│ completed │
└────┬──────┘
     │
     ▼
┌──────────┐
│ refunded │
└──────────┘
```

---

## 📝 Troubleshooting Checklist

When debugging payment issues, check:

- [ ] Payment exists in database
- [ ] Transaction ID is not null
- [ ] Provider matches ('mtn' or 'orange', not 'momo')
- [ ] User is authenticated
- [ ] Booking exists and belongs to user
- [ ] State transition is valid
- [ ] Provider API credentials are configured
- [ ] Network connectivity to provider API
- [ ] Logs show detailed error messages
- [ ] Database indexes exist
- [ ] No row-level security policy blocking query

---

## 🆘 Getting Help

If you're still stuck after following this guide:

1. **Check Logs:** `vercel logs` or local console
2. **Database Query:** Inspect payment record directly
3. **Simulation Test:** Use `/api/payments/simulate` to isolate issue
4. **Review Recent Changes:** Check git history for payment-related changes

---

## 📚 Related Documentation

- [Payment Architecture](./PAYMENT_ARCHITECTURE_ANALYSIS.md)
- [Payment Implementation](./PAYMENT_IMPLEMENTATION_COMPLETE.md)
- [Database Schema](../DATABASE_SCHEMA.md)
- [Notification Integration](../NOTIFICATION_INTEGRATION_PLAN.md)

---

**Last Updated:** January 2025  
**Version:** 2.0  
**Maintained By:** Development Team

