# Payment System Implementation - Complete

## Status: Production Ready

**Last Updated**: February 2026

---

## Architecture

```
CLIENT SIDE:
├── stores/paymentStore.ts       - Client state management (Zustand)
└── lib/api-client/payment.ts    - Type-safe HTTP client

SERVER SIDE:
├── lib/services/server/
│   ├── payment-service.ts                - Payment CRUD operations
│   ├── payment-creation-service.ts       - Payment initiation + provider routing
│   ├── payment-orchestration-service.ts  - Workflow coordinator (status changes, notifications)
│   ├── payment-notification-service.ts   - Push + WhatsApp payment notifications
│   └── bookings/
│       ├── booking-payout-service.ts     - Driver payout on code verification
│       └── booking-refund-service.ts     - Seat reduction + partial refund
│
├── lib/payment/
│   ├── mtn-momo-service.ts              - MTN MoMo (payin + payout + status)
│   ├── orange-money-service.ts          - Orange Money (payin + payout)
│   ├── pawapay-service.ts               - PawaPay aggregator (primary provider)
│   ├── payout-orchestrator.service.ts   - Unified provider orchestrator
│   ├── fee-calculator.ts                - Commission + fee calculation
│   └── phone-utils.ts                   - Phone operator detection
│
└── app/api/
    ├── payments/
    │   ├── create/route.ts              - Initiate payment (customer pays)
    │   └── check-status/route.ts        - Poll payment status from provider
    ├── callbacks/
    │   ├── om/route.ts                  - Orange Money callback
    │   └── pawapay/route.ts             - PawaPay callback
    └── payouts/
        └── check-status/route.ts        - Check payout status
```

---

## Payment Providers

| Provider | Type | Status |
|----------|------|--------|
| PawaPay | Primary aggregator (MTN + OM) | Production |
| MTN MoMo | Direct fallback | Production |
| Orange Money | Direct fallback | Production |

**Provider routing**: Controlled by `USE_PAWAPAY` env flag. When `true`, all payments go through PawaPay. When `false`, phone number prefix determines MTN vs Orange.

---

## Payment Flow

### Payin (Customer Pays)
1. Frontend calls `/api/payments/create` with booking, amount, provider, phone
2. `PaymentCreationService` creates DB record + initiates via provider
3. Frontend polls `/api/payments/check-status` until completed/failed
4. On completion, `PaymentOrchestrationService` updates booking + sends notifications

### Payout (Driver Gets Paid)
1. Driver verifies passenger code via `BookingPayoutService`
2. Service calculates `booking.seats * ridePrice` (source of truth for partial bookings)
3. `FeeCalculator` deducts commission + transaction fee
4. Payout initiated via provider, record stored in `payouts` table

### Partial Refund (Seat Reduction)
1. Passenger reduces seats via `BookingRefundService`
2. Refund amount = seats removed * price per seat
3. All completed payments marked `partial_refund`
4. `booking.seats` updated to new count (source of truth for payout)

---

## Key Features

- **Idempotency**: Duplicate payment prevention via idempotency keys
- **State Machine**: Valid status transitions enforced (`pending -> processing -> completed`)
- **Multi-Channel Notifications**: OneSignal push + WhatsApp on payment events
- **Fee Calculation**: Configurable commission + transaction fees
- **Sandbox Support**: Test phone numbers + environment switching
- **Partial Refunds**: Seat reduction with automatic refund + correct payout math

---

## Environment Variables

See `.env.local.example` for the complete list. Key groups:
- `USE_PAWAPAY` / `PAWAPAY_*` — Primary payment provider
- `MOMO_*` / `DIRECT_MOMO_*` — MTN MoMo direct integration
- `ORANGE_MONEY_*` / `DIRECT_OM_*` — Orange Money direct integration
- `SANDBOX_*_TEST_PHONE` — Test phone numbers for sandbox

---

## Related Documentation

- `docs/payments/payment-flow.md` — Detailed flow diagrams
- `docs/payments/status-management.md` — Status transitions
- `docs/payments/ENVIRONMENT_VARIABLES.md` — Full env var reference
- `docs/payments/SANDBOX_TESTING_CHECKLIST.md` — Testing guide
- `docs/PAYMENT_RED_FLAGS_AND_FIXES.md` — Historical issues and fixes
