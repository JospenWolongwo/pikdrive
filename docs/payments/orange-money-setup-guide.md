# Orange Money Integration Setup Guide

## Overview

This guide outlines the steps required to integrate Orange Money payment system into PikDrive. Keep track of your progress using the checkboxes.


## 1. Developer Registration

- [ ] Visit [Orange Developer Portal](https://developer.orange.com/)
- [ ] Create developer account
- [ ] Verify email address
- [ ] Complete developer profile


## 2. Business Registration

### Required Documents

- [ ] Business registration (RCCM)
- [ ] Tax registration (NIU)
- [ ] Valid government ID
- [ ] Proof of business address
- [ ] Active Orange Money account


### Submission Process

- [ ] Visit local Orange Money Business Center
- [ ] Submit all required documents
- [ ] Get business account verification
- [ ] Receive merchant account details


## 3. Technical Integration

### API Access Setup

- [ ] Submit Web Payment / M Payment API access request
- [ ] Provide technical contact details
- [ ] Submit integration use case
- [ ] Configure callback URLs:

```bash
Notification URL: https://your-domain/api/payments/orange/callback
Return URL: https://your-domain/payments/status
```

### Required Credentials

Once approved, you'll receive:

- [ ] Merchant ID (`ORANGE_MONEY_MERCHANT_ID`)
- [ ] Merchant Key (`ORANGE_MONEY_MERCHANT_KEY`)
- [ ] Sandbox environment access
- [ ] Production environment access (after testing)


## 4. Environment Variables Setup

Add these to `.env.local`:

```bash
# Orange Money Configuration
ORANGE_MONEY_MERCHANT_ID=your_merchant_id
ORANGE_MONEY_MERCHANT_KEY=your_merchant_key
ORANGE_MONEY_ENVIRONMENT=sandbox  # Change to 'production' when going live
ORANGE_MONEY_NOTIFICATION_URL=https://your-domain/api/payments/orange/callback
ORANGE_MONEY_RETURN_URL=https://your-domain/payments/status
```


## 5. Testing Process

### Sandbox Testing

- [ ] Use sandbox credentials
- [ ] Test with sandbox phone numbers:
  - 237699000001 (successful payment)
  - 237699000002 (failed payment)
  - 237690000001 (insufficient funds)
  - 237690000002 (timeout error)
- [ ] Test amount ranges:
  - Minimum: 100 XAF
  - Maximum: 500,000 XAF
- [ ] Verify webhook notifications
- [ ] Test payment status updates
- [ ] Validate error handling


### Production Testing

- [ ] Update environment variables to production
- [ ] Perform test transaction
- [ ] Verify live webhook notifications
- [ ] Confirm payment processing
- [ ] Test refund process (if applicable)


## Support Contacts

- Email: [digital.cm@orange.com](mailto:digital.cm@orange.com)
- Phone: 699 10 10 10
- Visit: Any Orange Business Center


## Integration Checklist

- [ ] Developer account created
- [ ] Business registration completed
- [ ] API access granted
- [ ] Environment variables configured
- [ ] Sandbox testing completed
- [ ] Production credentials received
- [ ] Live testing completed
- [ ] Documentation updated


## Notes

- Keep all credentials secure
- Never commit .env files to version control
- Maintain separate sandbox and production configurations
- Document any custom implementation details


## Troubleshooting

Common issues and solutions will be added here as we encounter them during integration.


---
Last Updated: March 4, 2025
