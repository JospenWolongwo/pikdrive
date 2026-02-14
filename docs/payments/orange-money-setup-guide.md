# Orange Money Integration Guide

## Overview

Orange Money is supported as both a direct integration and via PawaPay aggregator. This guide covers the direct integration setup for Cameroon (XAF).

---

## 1. Developer Registration

- [ ] Visit [Orange Developer Portal](https://developer.orange.com/)
- [ ] Create developer account and verify email
- [ ] Complete developer profile

## 2. Business Registration

### Required Documents
- Business registration (RCCM)
- Tax registration (NIU)
- Valid government ID
- Proof of business address
- Active Orange Money account

### Submission
- Visit local Orange Money Business Center
- Submit all required documents
- Get business account verification
- Receive merchant account details

## 3. API Access Setup

- [ ] Submit Web Payment / M Payment API access request
- [ ] Provide technical contact details
- [ ] Configure callback URLs:

```
Notification URL: https://your-domain/api/callbacks/om
Return URL: https://your-domain/payments/status
```

### Credentials You Will Receive
- Merchant ID (`DIRECT_OM_MERCHAND_NUMBER`)
- Consumer User / Secret (`DIRECT_OM_CONSUMER_USER`, `DIRECT_OM_CONSUMER_SECRET`)
- API Username / Password (`DIRECT_OM_API_USERNAME`, `DIRECT_OM_API_PASSWORD`)
- PIN Code (`DIRECT_OM_PIN_CODE`)
- Token URL and Base URL

## 4. Environment Variables

Add to `.env.local`:

```env
# Orange Money Configuration
ORANGE_MONEY_MERCHANT_ID=your_merchant_id
ORANGE_MONEY_MERCHANT_KEY=your_merchant_key
ORANGE_MONEY_ENVIRONMENT=sandbox
ORANGE_MONEY_NOTIFICATION_URL=https://your-domain/api/callbacks/om
ORANGE_MONEY_RETURN_URL=https://your-domain/payments/status

# Direct OM (overrides above if set)
DIRECT_OM_MERCHAND_NUMBER=your_merchant_number
DIRECT_OM_ENVIRONMENT=sandbox
DIRECT_OM_CALLBACK_URL=https://your-domain/api/callbacks/om
DIRECT_OM_CONSUMER_USER=
DIRECT_OM_CONSUMER_SECRET=
DIRECT_OM_API_USERNAME=
DIRECT_OM_API_PASSWORD=
DIRECT_OM_PIN_CODE=
DIRECT_OM_TOKEN_URL=
DIRECT_OM_BASE_URL=
```

## 5. Testing

### Sandbox Testing
- [ ] Configure sandbox credentials
- [ ] Test with sandbox phone numbers:
  - 237699000001 (successful payment)
  - 237699000002 (failed payment)
  - 237690000001 (insufficient funds)
  - 237690000002 (timeout error)
- [ ] Test amount ranges: 100 - 500,000 XAF
- [ ] Verify webhook notifications at `/api/callbacks/om`
- [ ] Validate error handling

### Production Testing
- [ ] Update environment to production
- [ ] Perform test transaction with real credentials
- [ ] Verify live webhook notifications
- [ ] Confirm payment processing

## 6. Code Reference

- Service: `lib/payment/orange-money-service.ts`
- Callback: `app/api/callbacks/om/route.ts`
- Orchestrator: `lib/payment/payout-orchestrator.service.ts`

## Support

- Email: digital.cm@orange.com
- Phone: 699 10 10 10
- Visit: Any Orange Business Center

---
Last Updated: February 2026
