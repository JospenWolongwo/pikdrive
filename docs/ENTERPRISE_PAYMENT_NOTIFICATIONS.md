# 🏢 Enterprise-Level Payment Notification System

## Overview

Professional payment notification system following best practices from Stripe, Square, and top fintech companies. Implements robust, scalable, and reliable notification delivery with comprehensive audit trails.

---

## 🎯 Architecture

### **1. Payment Flow**
```
Payment Status Change (MTN/OM Callback)
    ↓
Database Trigger (Automatic)
    ↓
Payment Event Queue
    ↓
OneSignal Edge Function
    ↓
Push Notifications (Passenger & Driver)
```

### **2. Key Components**

#### **A. Database Layer** (`supabase/migrations/20250107_add_payment_notification_triggers.sql`)
- ✅ **Payment Event Queue**: Reliable async processing with retry logic
- ✅ **Notification Log**: Comprehensive audit trail with idempotency support
- ✅ **Automatic Triggers**: Auto-queue events on payment status changes
- ✅ **Exponential Backoff**: Smart retry mechanism (2^n minutes)

#### **B. Service Layer** (`lib/services/server/payment-notification-service.ts`)
- ✅ **ServerPaymentNotificationService**: Orchestrates all payment notifications
- ✅ **ServerOneSignalNotificationService**: Handles OneSignal Edge Function calls
- ✅ **SMS Integration**: Professional MTN MoMo-style SMS notifications

#### **C. Edge Function** (`supabase/functions/send-notification/index.ts`)
- ✅ **OneSignal Integration**: Direct API calls with professional configuration
- ✅ **Multi-platform**: iOS, Android, Web push notifications
- ✅ **Sound Configuration**: Custom sound files per notification type

---

## 💰 Payment Notification Features

### **For Passengers (After Successful Payment)**
```javascript
{
  title: "🎉 Paiement Confirmé !",
  message: "Votre paiement de 5,000 XAF est confirmé pour Douala → Yaoundé. 
            Code de vérification: ABC123",
  data: {
    bookingId,
    paymentId,
    rideId,
    verificationCode: "ABC123",
    amount: 5000,
    type: "payment_completed"
  }
}
```

### **For Drivers (Enterprise-Level Enrichment)** 🌟
```javascript
{
  title: "💰 Nouveau Paiement Reçu !",
  message: "Jean Dupont a payé 5,000 XAF pour Douala → Yaoundé. 
            2 place(s). Code: ABC123",
  data: {
    bookingId,
    paymentId,
    rideId,
    type: "payment_completed_driver",
    
    // Passenger Details
    passengerId,
    passengerName: "Jean Dupont",
    passengerPhone: "+237670000000",
    passengerAvatar: "https://...",
    
    // Booking Details
    seats: 2,
    verificationCode: "ABC123",
    
    // Payment Details
    amount: 5000,
    provider: "mtn",
    transactionId: "MTN-123456",
    
    // Ride Details
    fromCity: "Douala",
    toCity: "Yaoundé",
    departureTime: "2025-01-10T08:00:00Z"
  }
}
```

---

## 🚀 How It Works

### **1. Automatic Payment Status Detection**

When MTN MoMo or Orange Money sends a callback:
```typescript
// app/api/payments/mtn/callback/route.ts
POST /api/payments/mtn/callback
  ↓
PaymentService.handlePaymentCallback()
  ↓
PaymentOrchestrationService.handlePaymentStatusChange()
  ↓
Payment status updated to 'completed'
  ↓
🔥 DATABASE TRIGGER FIRES AUTOMATICALLY
```

### **2. Event Queue Processing**
```sql
-- Trigger automatically queues event
CREATE TRIGGER trigger_queue_payment_notification
AFTER UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION queue_payment_notification();
```

The trigger creates a comprehensive event with:
- Payment details (amount, provider, status)
- Booking details (seats, verification code)
- Ride details (route, times, price)
- Passenger details (name, phone)
- Driver details (name, phone)

### **3. Notification Delivery**
```typescript
// lib/services/server/payment-orchestration-service.ts
private async handleCompletedPayment(payment: Payment) {
  await Promise.all([
    this.bookingService.updateBooking(payment.booking_id, {
      payment_status: 'completed',
      status: 'pending_verification'
    }),
    this.receiptService.createReceipt(payment.id),
    // 🎯 THIS SENDS THE NOTIFICATIONS
    this.notificationService.notifyPaymentCompleted(payment)
  ]);
}
```

---

## 🎨 Professional Features

### **1. Idempotency Protection**
```sql
CREATE TABLE payment_notification_log (
  id UUID PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  notification_type TEXT,
  recipient_id UUID,
  onesignal_id TEXT, -- Prevents duplicates
  status TEXT,
  ...
);
```

### **2. Retry Logic with Exponential Backoff**
```sql
-- Automatic retry calculation
next_retry_at := NOW() + (POWER(2, retry_count) || ' minutes')::INTERVAL;
-- Retry 1: 2 minutes
-- Retry 2: 4 minutes
-- Retry 3: 8 minutes
```

### **3. Comprehensive Audit Trail**
Every notification attempt is logged with:
- ✅ Timestamp
- ✅ Recipient details
- ✅ Channel (push/sms/email)
- ✅ Status (sent/failed/retrying)
- ✅ OneSignal notification ID
- ✅ Error messages
- ✅ Number of attempts

### **4. Sound Configuration**
```typescript
// supabase/functions/send-notification/index.ts
{
  ios_sound: "payment-success.wav",
  android_sound: "payment_success",
  android_channel_id: "pikdrive_payments",
  priority: 10
}
```

---

## 📊 Database Schema

### **Payment Event Queue**
```sql
CREATE TABLE payment_event_queue (
  id UUID PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  event_type TEXT, -- 'payment_completed', 'payment_failed'
  event_data JSONB, -- Complete payment/booking/ride/user data
  status TEXT, -- 'pending', 'processing', 'completed', 'failed'
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Notification Log**
```sql
CREATE TABLE payment_notification_log (
  id UUID PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  notification_type TEXT,
  recipient_id UUID,
  recipient_type TEXT, -- 'passenger' or 'driver'
  notification_channel TEXT, -- 'push', 'sms', 'email'
  status TEXT, -- 'pending', 'sent', 'failed'
  onesignal_id TEXT,
  attempts INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔧 Configuration

### **Environment Variables**
```bash
# OneSignal (Edge Function)
NEXT_PUBLIC_ONESIGNAL_APP_ID=your-app-id
NEXT_PUBLIC_ONESIGNAL_API_KEY=your-api-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# SMS (Optional)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_FROM_NUMBER=+1234567890
```

### **Deploy Edge Function**
```bash
# Deploy OneSignal notification function
supabase functions deploy send-notification

# Test the function
curl -X POST "https://your-project.supabase.co/functions/v1/send-notification" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "title": "Test Notification",
    "message": "This is a test",
    "notificationType": "test"
  }'
```

---

## 🎯 Comprehensive Testing

### **Pre-Test Setup**

1. **Deploy Edge Function**
```bash
cd supabase/functions
supabase functions deploy send-notification

# Verify deployment
supabase functions list
```

2. **Run Database Migration**
```bash
supabase migration up
# This creates:
# - payment_event_queue table
# - payment_notification_log table
# - Automatic triggers
```

3. **Verify Environment Variables**
```bash
# Check Edge Function has these set:
supabase secrets list

Required:
- NEXT_PUBLIC_ONESIGNAL_APP_ID
- NEXT_PUBLIC_ONESIGNAL_API_KEY  
- NEXT_PUBLIC_APP_URL (for icon URLs)
- SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
```

---

### **Test 1: Edge Function Direct Test**

```bash
# Test send-notification Edge Function directly
curl -X POST "https://your-project.supabase.co/functions/v1/send-notification" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "title": "Payment Confirmed",
    "message": "Your payment of 5,000 XAF has been confirmed for Douala to Yaoundé. Verification code: ABC123",
    "notificationType": "payment_success",
    "imageUrl": "/icons/payment-success.png",
    "data": {
      "bookingId": "test-booking-id",
      "amount": 5000,
      "verificationCode": "ABC123"
    }
  }'

# Expected Response:
{
  "success": true,
  "notificationId": "onesignal-notification-id",
  "recipients": 1
}
```

---

### **Test 2: Complete Payment Flow (MTN MoMo)**

```typescript
// Step 1: Create booking (via your app)
const booking = await bookingApiClient.createBooking({
  ride_id: "ride-id",
  user_id: "passenger-id",
  seats: 2
});

// Step 2: Initiate payment
const payment = await fetch('/api/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bookingId: booking.id,
    amount: 5000,
    provider: 'mtn',
    phoneNumber: '+237670000000'
  })
});

// Step 3: Simulate MTN callback (in test environment)
await fetch('/api/payments/mtn/callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'SUCCESSFUL',
    financialTransactionId: 'MTN-123456',
    externalId: payment.data.id
  })
});

// Step 4: Verify notifications were sent
const { data: notifications } = await supabase
  .from('payment_notification_log')
  .select('*')
  .eq('payment_id', payment.data.id)
  .order('created_at', { ascending: false });

console.log('Notifications sent:', notifications);
// Expected: 2 notifications (passenger + driver)
```

---

### **Test 3: Verify Driver Receives Enriched Data**

```typescript
// After payment completion, check what driver receives
const { data: driverNotification } = await supabase
  .from('payment_notification_log')
  .select('*')
  .eq('payment_id', payment.id)
  .eq('recipient_type', 'driver')
  .single();

// Verify notification has all required data
console.assert(driverNotification.metadata.passenger_name, 'Passenger name missing');
console.assert(driverNotification.metadata.seats, 'Seats count missing');
console.assert(driverNotification.onesignal_id, 'OneSignal ID missing');

// Check the actual OneSignal notification via API
const oneSignalNotification = await fetch(
  `https://onesignal.com/api/v1/notifications/${driverNotification.onesignal_id}?app_id=${ONESIGNAL_APP_ID}`,
  {
    headers: {
      'Authorization': `Basic ${ONESIGNAL_API_KEY}`
    }
  }
);

const notifData = await oneSignalNotification.json();
console.log('Driver received notification:', {
  title: notifData.headings.en,
  message: notifData.contents.en,
  data: notifData.data
});
```

---

### **Test 4: Database Trigger Test**

```sql
-- Manually update payment to trigger notification
BEGIN;

-- Insert test payment
INSERT INTO payments (id, booking_id, amount, provider, status)
VALUES (
  gen_random_uuid(),
  'test-booking-id',
  5000,
  'mtn',
  'pending'
);

-- Update to completed (this should trigger notification queue)
UPDATE payments
SET status = 'completed',
    transaction_id = 'TEST-MTN-123'
WHERE id = (SELECT id FROM payments WHERE booking_id = 'test-booking-id');

-- Check if event was queued
SELECT * FROM payment_event_queue
WHERE payment_id = (SELECT id FROM payments WHERE booking_id = 'test-booking-id')
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK; -- Don't actually save test data
```

---

### **Test 5: Icon URLs Test**

```bash
# Verify icon URLs are accessible
curl -I https://your-app-url/icons/payment-success.png
curl -I https://your-app-url/icons/payment-received.png
curl -I https://your-app-url/icons/booking-confirmed.png

# Expected: 200 OK responses

# Test Edge Function constructs correct URLs
# Check OneSignal dashboard for sent notifications
# Verify large_icon and chrome_web_icon fields have correct URLs
```

---

### **Test 6: Sound Configuration Test**

```typescript
// Test different notification types use correct sounds
const tests = [
  { type: 'payment_success', expectedSound: 'payment-success.wav' },
  { type: 'payment_failed', expectedSound: 'payment-failed.wav' },
  { type: 'booking_confirmed', expectedSound: 'booking-confirmed.wav' },
  { type: 'new_message', expectedSound: 'new-message.wav' },
];

for (const test of tests) {
  await fetch('/functions/v1/send-notification', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: 'test-user',
      title: 'Test',
      message: 'Test',
      notificationType: test.type
    })
  });
  
  // Check OneSignal dashboard to verify sound was set correctly
}
```

---

### **Test 7: Monitor Event Queue**

```sql
-- Check pending events
SELECT 
  id,
  event_type,
  status,
  retry_count,
  created_at
FROM payment_event_queue 
WHERE status IN ('pending', 'failed')
ORDER BY created_at DESC;

-- Check notification success rate (last 24 hours)
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM payment_notification_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Check retry attempts
SELECT 
  payment_id,
  retry_count,
  status,
  error_message,
  next_retry_at
FROM payment_event_queue
WHERE retry_count > 0
ORDER BY retry_count DESC;
```

---

### **Test 8: Idempotency Test**

```typescript
// Simulate duplicate webhook calls
const paymentId = 'test-payment-id';

// Call 1
await fetch('/api/payments/mtn/callback', {
  method: 'POST',
  body: JSON.stringify({
    status: 'SUCCESSFUL',
    externalId: paymentId
  })
});

// Call 2 (duplicate)
await fetch('/api/payments/mtn/callback', {
  method: 'POST',
  body: JSON.stringify({
    status: 'SUCCESSFUL',
    externalId: paymentId
  })
});

// Verify only ONE set of notifications was sent
const { data, count } = await supabase
  .from('payment_notification_log')
  .select('*', { count: 'exact' })
  .eq('payment_id', paymentId);

console.assert(count === 2, 'Should have exactly 2 notifications (passenger + driver)');
```

---

### **Test 9: Error Handling & Retry Test**

```typescript
// Temporarily break OneSignal connection (wrong API key)
// Then trigger payment completion
// Check that:
// 1. Event is marked as 'failed' in queue
// 2. Retry logic kicks in
// 3. next_retry_at is set correctly

const { data: failedEvents } = await supabase
  .from('payment_event_queue')
  .select('*')
  .eq('status', 'failed')
  .order('created_at', { ascending: false });

for (const event of failedEvents) {
  const retryDelay = new Date(event.next_retry_at) - new Date(event.created_at);
  const expectedDelay = Math.pow(2, event.retry_count) * 60 * 1000; // minutes to ms
  
  console.log({
    retryCount: event.retry_count,
    actualDelay: retryDelay / 60000, // ms to minutes
    expectedDelay: expectedDelay / 60000
  });
}
```

---

### **Test 10: Full Integration Test**

```bash
# Run complete flow from booking to notification
npm run test:integration

# Or manually:
# 1. Create booking
# 2. Initiate payment
# 3. Simulate provider callback
# 4. Verify database triggers fired
# 5. Verify notifications sent
# 6. Verify notification content is correct
# 7. Check no errors in logs
```

---

### **Monitoring Queries**

```sql
-- Daily notification metrics
SELECT 
  DATE_TRUNC('day', created_at) as date,
  notification_type,
  status,
  COUNT(*) as count
FROM payment_notification_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY date, notification_type, status
ORDER BY date DESC, notification_type;

-- Average retry attempts before success
SELECT 
  AVG(retry_count) as avg_retries,
  MAX(retry_count) as max_retries
FROM payment_event_queue
WHERE status = 'completed'
  AND retry_count > 0;

-- Failed notifications that need attention
SELECT 
  p.id as payment_id,
  p.amount,
  p.provider,
  peq.retry_count,
  peq.error_message,
  peq.next_retry_at
FROM payment_event_queue peq
JOIN payments p ON peq.payment_id = p.id
WHERE peq.status = 'failed'
  AND peq.retry_count >= peq.max_retries
ORDER BY peq.created_at DESC;
```

---

## 🏆 Best Practices Implemented

✅ **Idempotency**: Prevents duplicate notifications
✅ **Retry Logic**: Automatic retries with exponential backoff
✅ **Audit Trail**: Complete notification history
✅ **Error Handling**: Graceful failure with detailed logging
✅ **Scalability**: Queue-based async processing
✅ **Security**: RLS policies on notification tables
✅ **Performance**: Parallel notification delivery
✅ **Monitoring**: Comprehensive logging and metrics

---

## 📈 Monitoring & Maintenance

### **Cleanup Old Events**
```sql
-- Run periodically (e.g., daily cron job)
SELECT cleanup_old_payment_events();
-- Removes completed events older than 30 days
-- Removes failed events older than 7 days
```

### **Monitor Failure Rate**
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  status,
  COUNT(*) as count
FROM payment_notification_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, status
ORDER BY hour DESC;
```

---

## 🚀 Future Enhancements

- [ ] **Email Notifications**: Add email receipts
- [ ] **WhatsApp Integration**: Send confirmations via WhatsApp Business API
- [ ] **Analytics Dashboard**: Real-time notification metrics
- [ ] **A/B Testing**: Test different notification copy
- [ ] **User Preferences**: Allow users to configure notification channels

---

## 💡 Key Takeaways

1. **Automatic & Reliable**: Database triggers ensure no payment notification is missed
2. **Enterprise-Grade**: Follows patterns from Stripe, Square, and top fintech companies
3. **DRY & Clean**: Reuses existing OneSignal Edge Function
4. **Comprehensive**: Driver receives all needed info (passenger, booking, payment details)
5. **Production-Ready**: Complete error handling, retries, and audit trails

---

**Built with ❤️ for PikDrive - Professional, scalable, enterprise-level payment notifications**

