# Payment Status Management

## Status Types

```typescript
type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';
```

## Status Flow

### 1. Pending
- Initial state when payment is created
- Waiting for user to approve on their phone
- Maximum duration: 5 minutes
- Transitions to:
  - Processing (when user approves)
  - Failed (on timeout or error)

### 2. Processing
- Payment approved by user
- MTN MOMO processing the transaction
- Maximum duration: 2 minutes
- Transitions to:
  - Completed (on success)
  - Failed (on error)

### 3. Completed
- Final successful state
- Payment confirmed by MTN MOMO
- Has financialTransactionId
- Triggers:
  - Receipt generation
  - Booking status update
  - Success notification

### 4. Failed
- Final failure state
- Reasons:
  - User rejection
  - Insufficient funds
  - Timeout
  - System error
- Allows retry with new payment

## Status Check Implementation

### 1. Frontend Polling
```typescript
// components/payment/payment-status-checker.tsx
export function PaymentStatusChecker({
  transactionId,
  provider,
  onPaymentComplete,
  pollingInterval = 5000, // 5 seconds
  maxAttempts = 60 // 5 minutes total
})
```

### 2. Background Job
```typescript
// app/api/cron/check-pending-payments/route.ts
// Runs every 5 minutes
export async function GET(request: Request) {
  // Check stale pending payments
  // Update status if changed
  // Generate receipts if completed
}
```

### 3. Webhook Handler (Coming Soon)
```typescript
// app/api/webhooks/mtn-momo/route.ts
export async function POST(request: Request) {
  // Verify webhook signature
  // Update payment status
  // Handle completion/failure
}
```

## Status Update Triggers

### 1. Direct Updates
- Frontend polling
- Background job checks
- Webhook notifications
- Manual admin action

### 2. Automatic Updates
- Timeout after 5 minutes
- System error detection
- Network failure handling

## Database Schema

```sql
CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

ALTER TABLE payments
ADD COLUMN status payment_status DEFAULT 'pending';
```

## Status Validation

### 1. State Transitions
```typescript
const validTransitions = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: [],
  failed: []
};
```

### 2. Validation Rules
1. Can only move to allowed next states
2. Cannot revert to previous states
3. Completed/Failed are final states
4. Must have transaction ID
5. Must track transition timestamps

## Monitoring

### 1. Status Metrics
- Time in each state
- Transition success rates
- Error frequency
- Stale payment count

### 2. Alerts
- Stale pending > 15 minutes
- High failure rate
- Unusual state transitions
- System errors

## Error Recovery

### 1. Automatic Recovery
- Retry failed status checks
- Reset stuck processing state
- Clear invalid states

### 2. Manual Recovery
- Admin dashboard actions
- Support ticket system
- Direct database fixes

## Testing

### 1. Unit Tests
- State transition logic
- Validation rules
- Error handling

### 2. Integration Tests
- Full payment flow
- Status update triggers
- Receipt generation

### 3. Load Tests
- Multiple concurrent payments
- High frequency status checks
- Background job performance
