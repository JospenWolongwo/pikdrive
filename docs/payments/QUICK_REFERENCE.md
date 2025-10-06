# Payment System - Quick Reference

## 🚀 Common Tasks

### Check Payment Status
```typescript
import { paymentApiClient } from '@/lib/api-client/payment';

const result = await paymentApiClient.checkPaymentStatus(
  transactionId,
  'mtn',
  bookingId // ✅ Optional but recommended for resilience
);
```

### Simulate Payment (Testing)
```bash
curl -X POST http://localhost:3000/api/payments/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "abc-123",
    "newStatus": "completed"
  }'
```

### Query Recent Payments (SQL)
```sql
SELECT id, transaction_id, status, booking_id, created_at 
FROM payments 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🔍 Debugging

### Log Search Patterns
```bash
# Check status operations
npm run dev | grep "CHECK-STATUS"

# Payment errors
npm run dev | grep "❌.*payment"

# All payment operations
npm run dev | grep -E "(CHECK-STATUS|CREATE-PAYMENT|SIMULATE)"
```

### Common Errors

**"Payment not found"**
- Wait 2 seconds and retry
- Check if payment exists in database
- Verify transaction_id is correct

**"Type mismatch"**
- Use `'mtn'` or `'orange'` (not `'momo'`)
- Check database enum matches code

**"Invalid state transition"**
- Review state machine: pending → processing → completed
- Can't transition from completed to failed

---

## 📊 Valid Status Transitions

```
pending     → processing, failed, cancelled
processing  → completed, failed
completed   → refunded
failed      → (no transitions)
cancelled   → (no transitions)
refunded    → (no transitions)
```

---

## 🛠 Useful SQL Queries

### Find Payment by Transaction ID
```sql
SELECT * FROM payments 
WHERE transaction_id = 'your-transaction-id';
```

### Find Payments by Booking
```sql
SELECT * FROM payments 
WHERE booking_id = 'your-booking-id'
ORDER BY created_at DESC;
```

### Find Stuck Payments
```sql
SELECT * FROM payments 
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '10 minutes';
```

### Payment Success Rate (Last 24h)
```sql
SELECT 
  COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) * 100 as success_rate
FROM payments
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## 🎯 Best Practices

### Frontend
1. ✅ Always pass `bookingId` to status checks
2. ✅ Wait 2 seconds before first poll
3. ✅ Use exponential backoff for retries
4. ✅ Show clear error messages to users

### Backend
1. ✅ Use `maybeSingle()` not `single()`
2. ✅ Implement fallback strategies
3. ✅ Log with structured tags `[OPERATION]`
4. ✅ Handle provider API failures gracefully

### Database
1. ✅ Always use idempotency keys
2. ✅ Index frequently queried columns
3. ✅ Use proper state machine transitions
4. ✅ Clean up old test data regularly

---

## 🔗 Documentation

- [Debugging Guide](./PAYMENT_DEBUGGING_GUIDE.md) - Comprehensive troubleshooting
- [Resilience Upgrade](./PAYMENT_RESILIENCE_UPGRADE.md) - Technical details
- [Architecture Analysis](./PAYMENT_ARCHITECTURE_ANALYSIS.md) - System design

---

**Quick Help:** Use `/api/payments/simulate` for testing without real transactions!

