# Payment Status Management

## Payment Status Types

```typescript
type PaymentTransactionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'partial_refund'
  | 'failed'
  | 'cancelled'
  | 'refunded';
```

## Status Flow

```
pending ──> processing ──> completed ──> partial_refund ──> refunded
  │              │                            │
  └──> failed    └──> failed                  └──> refunded
  └──> cancelled
```

### 1. Pending
- Initial state when payment is created
- Waiting for user to approve on their phone
- Maximum duration: ~5 minutes
- Transitions to: `processing`, `failed`, `cancelled`

### 2. Processing
- Payment approved by user, provider is processing
- Transitions to: `completed`, `failed`

### 3. Completed
- Payment confirmed by provider
- Triggers: receipt generation, booking status update, notifications
- Transitions to: `partial_refund`, `refunded`

### 4. Partial Refund
- Some seats were reduced, partial refund issued
- Booking still active with remaining seats
- Driver payout uses `booking.seats * ridePrice` (not payment amount)
- Transitions to: `refunded`

### 5. Failed
- Final failure state (user rejection, insufficient funds, timeout)
- Allows retry with a new payment

### 6. Cancelled
- Payment cancelled before processing
- Final state

### 7. Refunded
- Full refund issued (booking cancelled entirely)
- Final state

## State Transitions (Code)

```typescript
const validTransitions: Record<PaymentTransactionStatus, PaymentTransactionStatus[]> = {
  pending: ['processing', 'failed', 'cancelled'],
  processing: ['completed', 'failed'],
  completed: ['refunded', 'partial_refund'],
  partial_refund: ['refunded'],
  failed: [],
  cancelled: [],
  refunded: [],
};
```

## Booking Payment Status

The `bookings.payment_status` field tracks the booking-level payment state:

| Status | Meaning |
|--------|---------|
| `pending` | No payment yet |
| `completed` | Fully paid |
| `partial` | Seats reduced, refund initiated (transient) |
| `partial_refund` | Refund completed, booking still active with remaining seats |

### Seat Reduction Flow
1. User reduces seats -> `booking.payment_status = 'partial'`
2. ALL completed payments marked `'partial_refund'`
3. Refund callback completes -> `booking.payment_status = 'partial_refund'`
4. Driver verifies code -> payout = `booking.seats * ride.price`

## Status Check Implementation

### Frontend Polling
```typescript
// Polls /api/payments/check-status every 5 seconds
// Maximum 60 attempts (5 minutes)
// Stops on: completed, failed, cancelled, refunded
```

### Cron Job
```
/api/cron/check-pending-payments (daily at 3 AM UTC)
```
Checks stale pending/processing payments and marks them as failed if expired.

### Provider Callbacks
- PawaPay: `/api/callbacks/pawapay`
- Orange Money: `/api/callbacks/om`
- MTN MoMo: `/api/webhooks/mtn-momo`

---
Last Updated: February 2026
