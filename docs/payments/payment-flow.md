# Payment Flows

## 1. Payin Flow (Customer Pays)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant P as Provider
    participant D as Database

    U->>F: Click "Pay Now"
    F->>B: POST /api/payments/create
    B->>D: Create payment record (pending)
    B->>P: Initiate payment (PawaPay/MTN/OM)
    P-->>B: Transaction ID
    B->>D: Update payment (processing)
    B-->>F: Return Transaction ID
    F->>F: Start status polling

    loop Every 5 seconds (max 60 attempts)
        F->>B: POST /api/payments/check-status
        B->>P: Check payment status
        P-->>B: Status response
        B->>D: Update if changed
        B-->>F: Return status
    end

    Note over B,D: On completed
    B->>D: Update booking (pending_verification)
    B->>D: Generate receipt
    B->>B: Send push + WhatsApp notifications
```

### Key Files
- `app/api/payments/create/route.ts` — Payment initiation
- `app/api/payments/check-status/route.ts` — Status polling
- `lib/services/server/payment-creation-service.ts` — Provider routing
- `lib/services/server/payment-orchestration-service.ts` — Status change handling

---

## 2. Payout Flow (Driver Gets Paid)

```mermaid
sequenceDiagram
    participant D as Driver
    participant F as Frontend
    participant B as Backend
    participant P as Provider
    participant DB as Database

    D->>F: Enter verification code
    F->>B: POST /api/bookings/verify-code
    B->>DB: Verify code (RPC)
    B->>DB: Fetch booking + ride + payments
    B->>B: Calculate payout amount
    Note over B: booking.seats * ride.price (source of truth)
    B->>B: FeeCalculator.calculate(totalAmount)
    Note over B: Deduct commission + transaction fee
    B->>P: Initiate payout (driverEarnings)
    P-->>B: Payout result
    B->>DB: Create payout record
    B->>DB: Mark booking code_verified=true
    B-->>F: Return payout status
```

### Key Files
- `lib/services/server/bookings/booking-payout-service.ts` — Payout logic
- `lib/payment/fee-calculator.ts` — Fee calculation

### Payout Calculation
```
totalAmount = booking.seats * ride.price
transactionFee = FeeCalculator.transactionFee(totalAmount)
commission = FeeCalculator.commission(totalAmount)
driverEarnings = totalAmount - transactionFee - commission
```

For partial bookings (seats reduced after refund), `booking.seats` is always the source of truth.

---

## 3. Refund Flow (Seat Reduction)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant P as Provider
    participant DB as Database

    U->>F: Reduce seats (e.g., 3 to 1)
    F->>B: POST /api/bookings/{id}/reduce-seats
    B->>DB: Verify booking ownership + code not verified
    B->>DB: Update booking.seats = newSeats
    B->>DB: Update booking.payment_status = 'partial'
    B->>B: Calculate refund = seatsRemoved * pricePerSeat
    B->>P: Initiate refund
    P-->>B: Refund result
    B->>DB: Create refund record
    B->>DB: Mark ALL payments as 'partial_refund'
    B-->>F: Return refund status

    Note over P,DB: Later (refund callback)
    P->>B: Refund completed callback
    B->>DB: Update refund status = 'completed'
    B->>DB: Update booking.payment_status = 'partial_refund'
```

### Key Files
- `lib/services/server/bookings/booking-refund-service.ts` — Refund logic
- `app/api/bookings/[id]/reduce-seats/route.ts` — API endpoint
- `lib/services/server/refund-status-service.ts` — Refund callback handling

### Important: All payments are marked `partial_refund`
When a booking has multiple individual payments (e.g., user added seats one by one), ALL completed payments are marked as `partial_refund` during seat reduction — not just one. This prevents the payout service from overpaying the driver.

---

## Error Handling

### Common Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Invalid phone number | Wrong format | Must be 237XXXXXXXXX |
| Payment timeout | No response in 5 min | Marked as failed, user retries |
| Insufficient funds | User balance too low | User tops up and retries |
| Provider unavailable | API down | Retry or switch provider |

### Sandbox Testing
- PawaPay sandbox: Use test numbers from PawaPay dashboard
- MTN sandbox: `SANDBOX_MTN_TEST_PHONE` env var
- Amount limits: 100 - 500,000 XAF

---
Last Updated: February 2026
