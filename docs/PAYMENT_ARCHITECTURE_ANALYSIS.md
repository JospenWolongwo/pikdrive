# Payment Architecture Analysis & Refactoring Plan

## 🎯 Executive Summary

This document analyzes our payment module architecture, identifies red flags, and proposes a refactoring plan following the clean patterns established in our booking module while incorporating enterprise payment best practices.

---

## ✅ What We're Doing RIGHT (Booking Module)

### 1. **Clean Service Layer Separation**
```typescript
// CLIENT SIDE: lib/api-client/booking.ts
export class BookingApiClient {
  async createBooking(params): Promise<BookingApiResponse<Booking>> {
    return apiClient.post('/api/bookings', params); // HTTP calls only
  }
}

// SERVER SIDE: lib/services/server/booking-service.ts
export class ServerBookingService {
  constructor(private supabase: SupabaseClient) {}
  
  async createBooking(params): Promise<Booking> {
    // Direct database access - no HTTP calls
    return this.supabase.from('bookings').insert(params);
  }
}
```

**Why This Is Good:**
- ✅ No circular dependencies
- ✅ Client-side never touches database directly
- ✅ Server-side never makes HTTP calls to itself
- ✅ Clear separation of concerns
- ✅ Easy to test and mock

### 2. **Consistent State Management**
```typescript
// stores/bookingStore.ts
interface BookingState {
  // Organized state sections
  userBookings: BookingWithDetails[];
  userBookingsLoading: boolean;
  userBookingsError: string | null;
  lastUserBookingsFetch: number | null;
  
  // Clear action names
  fetchUserBookings: (userId: string) => Promise<void>;
  refreshUserBookings: (userId: string) => Promise<void>;
}
```

**Why This Is Good:**
- ✅ Predictable state shape
- ✅ Granular loading/error states
- ✅ Built-in caching with timestamps
- ✅ Consistent naming conventions
- ✅ Type-safe throughout

### 3. **Proper API Response Handling**
```typescript
interface BookingApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

**Why This Is Good:**
- ✅ Consistent response format
- ✅ Explicit success/failure handling
- ✅ Type-safe data access
- ✅ Error messages included

---

## 🚨 RED FLAGS in Payment Module

### 1. **CRITICAL: Missing Client-Side Payment Store**

**Current State:**
- ❌ No `usePaymentStore` exists
- ❌ Components directly call payment service or API routes
- ❌ No centralized payment state management
- ❌ No caching mechanism
- ❌ Inconsistent error handling across components

**Impact:**
- Multiple payment status checks hitting API unnecessarily
- No way to track payment history client-side
- Difficult to maintain payment UI state
- Poor user experience with loading states

### 2. **CRITICAL: Server Payment Service Violates SRP**

**Current State:**
```typescript
// lib/payment/payment-service.ts (900+ lines!)
export class PaymentService {
  // Mixing multiple responsibilities:
  - Payment creation
  - Status checking
  - MTN MOMO integration
  - Orange Money integration
  - Receipt generation
  - SMS notifications
  - Booking updates
  - Push notifications
  - Phone number validation
  - Mock payment flows
}
```

**Problems:**
- ❌ 900+ lines (violates 200-line rule)
- ❌ Mixed concerns (payments + notifications + bookings)
- ❌ Hard to test
- ❌ Hard to maintain
- ❌ No clear single responsibility

### 3. **CRITICAL: Missing Client API Layer**

**Current Structure:**
```
Client Code → Direct API Route Calls → PaymentService
```

**Missing:**
- ❌ No `lib/api-client/payment.ts`
- ❌ No `PaymentApiClient` class
- ❌ No consistent API interface
- ❌ No request/response type safety

### 4. **MAJOR: Inconsistent API Response Format**

**Payment Routes:**
```typescript
// Some return this:
{ success: false, error: "message", details: {...} }

// Others return this:
{ success: true, transactionId: "...", status: "...", message: "..." }

// Others return this:
{ success: true, status: "...", message: "..." }
```

**Booking Routes (Consistent):**
```typescript
// Always return this:
{ success: boolean, data?: T, error?: string }
```

### 5. **MAJOR: Payment Service Has Direct Business Logic**

**Current:**
```typescript
// Inside PaymentService.checkPaymentStatus():
if (paymentStatus === "completed") {
  // Updating bookings (not payment's responsibility!)
  await this.supabase.from("bookings").update({
    status: "pending_verification",
    payment_status: paymentStatus,
  });
  
  // Creating receipts (should be separate service!)
  await this.createReceipt(payment.id);
  
  // Sending notifications (should be separate service!)
  await this.smsService.sendMessage(...);
  
  // Making HTTP calls from server side (BAD!)
  await fetch("/api/notifications/booking", {...});
}
```

**Problems:**
- ❌ Payment service modifying bookings directly
- ❌ Payment service handling notifications
- ❌ Server-side making HTTP calls to itself
- ❌ Tight coupling between modules
- ❌ Hard to test payment logic in isolation

### 6. **MAJOR: Idempotency Issues**

**Current:**
```typescript
async createPayment(request: PaymentRequest) {
  // No idempotency key
  // No duplicate detection
  // Can create multiple payments for same booking
}
```

**Enterprise Standard:**
```typescript
async createPayment(request: PaymentRequest & { idempotencyKey: string }) {
  // Check if payment with this key exists
  const existing = await this.getPaymentByIdempotencyKey(request.idempotencyKey);
  if (existing) return existing; // Return existing payment
  
  // Create new payment
  return this.createNewPayment(request);
}
```

### 7. **MAJOR: No Payment Audit Trail**

**Current:**
```typescript
// Payments table only tracks current status
// No history of status changes
// No audit log of who did what
```

**Should Have:**
- Payment status history table
- Audit log for all payment operations
- Webhook delivery attempts tracking
- Refund/reversal tracking

### 8. **MODERATE: Missing Payment Types in Central Types**

**Current:**
```typescript
// types/payment.ts - Basic types only
// lib/payment/types.ts - Duplicate types
// Inconsistent usage across codebase
```

### 9. **MODERATE: No Retry Logic for Failed Payments**

**Current:**
```typescript
// Payment fails → User must start over
// No retry mechanism
// No exponential backoff
// No automatic retry queue
```

### 10. **MODERATE: Webhook Security**

**Current:**
```typescript
// app/api/payments/callback/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  // ❌ No signature verification
  // ❌ No IP whitelist
  // ❌ No replay attack protection
}
```

---

## 🏢 Enterprise Payment Best Practices

### 1. **Idempotency**
- Every payment request must have an idempotency key
- Duplicate requests return the same result
- Prevents double-charging

### 2. **Audit Trail**
- Log every payment state change
- Track who/what triggered each change
- Immutable audit logs

### 3. **Webhook Security**
- Verify webhook signatures (HMAC)
- IP whitelist for webhook sources
- Replay attack protection (timestamp + nonce)

### 4. **Retry Logic**
- Exponential backoff for failed operations
- Maximum retry limits
- Dead letter queue for permanent failures

### 5. **State Machine**
- Explicit state transitions
- Validate allowed transitions
- Prevent invalid state changes

### 6. **Separation of Concerns**
```
PaymentService → Only payment operations
BookingService → Only booking operations
NotificationService → Only notifications
ReceiptService → Only receipts
```

### 7. **PCI Compliance (if handling cards)**
- Never log sensitive data
- Tokenize payment methods
- Use PCI-compliant providers

### 8. **Monitoring & Alerting**
- Track payment success rates
- Alert on high failure rates
- Monitor processing times
- Track revenue metrics

### 9. **Graceful Degradation**
- Handle provider outages
- Queue payments during downtime
- Clear user communication

### 10. **Testing**
- Unit tests for payment logic
- Integration tests for full flow
- Load tests for concurrent payments
- Chaos testing for failure scenarios

---

## 📊 Comparison: Booking vs Payment

| Aspect | Booking ✅ | Payment ❌ |
|--------|-----------|-----------|
| Client Store | ✅ `useBookingStore` | ❌ No store |
| Client API Layer | ✅ `BookingApiClient` | ❌ No client layer |
| Server Service | ✅ `ServerBookingService` | ⚠️ Mixed concerns |
| Line Count | ✅ ~287 lines | ❌ ~929 lines |
| Single Responsibility | ✅ Yes | ❌ No |
| API Response Format | ✅ Consistent | ❌ Inconsistent |
| State Management | ✅ Zustand + persist | ❌ None |
| Caching | ✅ Timestamp-based | ❌ None |
| Error Handling | ✅ Granular | ⚠️ Mixed |
| Type Safety | ✅ Full | ⚠️ Partial |

---

## 🎯 Refactoring Plan

### Phase 1: Create Clean Payment Architecture (Priority: HIGH)

**1. Create Payment Store** (`stores/paymentStore.ts`)
```typescript
interface PaymentState {
  // User payments state
  userPayments: Payment[];
  userPaymentsLoading: boolean;
  userPaymentsError: string | null;
  
  // Current payment state
  currentPayment: Payment | null;
  currentPaymentLoading: boolean;
  currentPaymentError: string | null;
  
  // Payment creation state
  isCreatingPayment: boolean;
  createPaymentError: string | null;
  
  // Actions
  createPayment: (params: CreatePaymentRequest) => Promise<Payment>;
  checkPaymentStatus: (transactionId: string, provider: string) => Promise<PaymentStatus>;
  fetchUserPayments: (userId: string) => Promise<void>;
  clearPayments: () => void;
}
```

**2. Create Payment API Client** (`lib/api-client/payment.ts`)
```typescript
export class PaymentApiClient {
  async createPayment(params: CreatePaymentRequest): Promise<PaymentApiResponse<Payment>>;
  async checkPaymentStatus(transactionId: string, provider: string): Promise<PaymentApiResponse<PaymentStatusResult>>;
  async getPaymentById(paymentId: string): Promise<PaymentApiResponse<Payment>>;
  async getUserPayments(userId: string): Promise<PaymentApiResponse<Payment[]>>;
  async getPaymentByBooking(bookingId: string): Promise<PaymentApiResponse<Payment | null>>;
}
```

**3. Refactor Server Payment Service** (`lib/services/server/payment-service.ts`)
```typescript
// ONLY handle payment operations - no bookings, no notifications
export class ServerPaymentService {
  constructor(private supabase: SupabaseClient) {}
  
  async createPayment(params: CreatePaymentRequest): Promise<Payment>;
  async getPaymentById(paymentId: string): Promise<Payment | null>;
  async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<Payment>;
  async getPaymentByBooking(bookingId: string): Promise<Payment | null>;
  async getUserPayments(userId: string): Promise<Payment[]>;
}
```

**4. Create Separate Services**
```typescript
// lib/services/server/receipt-service.ts
export class ServerReceiptService {
  async createReceipt(paymentId: string): Promise<Receipt>;
}

// lib/services/server/payment-webhook-service.ts
export class ServerPaymentWebhookService {
  async handleWebhook(provider: string, payload: any): Promise<void>;
  async verifySignature(provider: string, signature: string, payload: any): Promise<boolean>;
}

// lib/services/server/payment-notification-service.ts
export class ServerPaymentNotificationService {
  async notifyPaymentComplete(paymentId: string): Promise<void>;
  async notifyPaymentFailed(paymentId: string): Promise<void>;
}
```

### Phase 2: Update API Routes (Priority: HIGH)

**1. Standardize Response Format**
```typescript
// All payment routes return:
interface PaymentApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

**2. Use Server Services**
```typescript
// app/api/payments/create/route.ts
export async function POST(request: NextRequest) {
  const supabase = createApiSupabaseClient();
  const paymentService = new ServerPaymentService(supabase);
  
  // Only payment creation logic here
  const payment = await paymentService.createPayment(params);
  
  return NextResponse.json({ success: true, data: payment });
}
```

### Phase 3: Add Enterprise Features (Priority: MEDIUM)

**1. Idempotency**
```typescript
interface CreatePaymentRequest {
  bookingId: string;
  amount: number;
  provider: string;
  phoneNumber: string;
  idempotencyKey: string; // Required!
}
```

**2. Audit Trail**
```sql
CREATE TABLE payment_audit_log (
  id UUID PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  action VARCHAR(50) NOT NULL, -- 'created', 'status_updated', 'refunded'
  old_status payment_status,
  new_status payment_status,
  triggered_by UUID REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**3. State Machine**
```typescript
const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: ['refunded'],
  failed: [],
  refunded: []
};

function validateTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
```

### Phase 4: Security & Monitoring (Priority: MEDIUM)

**1. Webhook Security**
```typescript
async function verifyWebhookSignature(
  provider: string,
  signature: string,
  payload: string
): Promise<boolean> {
  const secret = getWebhookSecret(provider);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**2. Monitoring**
```typescript
// lib/services/server/payment-metrics-service.ts
export class ServerPaymentMetricsService {
  async trackPaymentCreated(payment: Payment): Promise<void>;
  async trackPaymentCompleted(payment: Payment): Promise<void>;
  async trackPaymentFailed(payment: Payment, reason: string): Promise<void>;
  async getSuccessRate(timeframe: string): Promise<number>;
}
```

---

## 🚀 Implementation Priority

### Immediate (Week 1)
1. ✅ Create `stores/paymentStore.ts`
2. ✅ Create `lib/api-client/payment.ts`
3. ✅ Refactor `lib/services/server/payment-service.ts`
4. ✅ Update payment API routes

### Short-term (Week 2-3)
5. ✅ Add idempotency support
6. ✅ Create audit trail
7. ✅ Implement state machine validation
8. ✅ Add webhook signature verification

### Medium-term (Month 1)
9. ✅ Add retry logic
10. ✅ Implement monitoring
11. ✅ Add payment metrics
12. ✅ Create admin dashboard for payments

### Long-term (Month 2+)
13. ✅ Add automated testing
14. ✅ Implement refund flows
15. ✅ Add subscription support
16. ✅ Implement payment method tokenization

---

## 📝 Code Review Checklist

Before approving any payment-related PR, ensure:

- [ ] Uses `PaymentApiClient` on client-side
- [ ] Uses `ServerPaymentService` on server-side
- [ ] No HTTP calls from server to itself
- [ ] Consistent response format
- [ ] Idempotency key included
- [ ] Audit log entry created
- [ ] State transition validated
- [ ] Error handling complete
- [ ] Types are consistent
- [ ] Tests are included

---

## 🎓 Key Takeaways

1. **Separation is Key**: Client HTTP, Server DB - never mix
2. **Single Responsibility**: One service, one purpose
3. **Consistency Matters**: Same patterns across all modules
4. **Enterprise Standards**: Idempotency, audit trails, security
5. **Follow the Booking Pattern**: It's proven to work well

---

**Next Steps**: Let's implement Phase 1 - the foundational architecture changes.
