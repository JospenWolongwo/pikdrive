# SMS Service Setup Guide

## Overview
PikDrive uses two separate SMS systems:
1. **Authentication SMS** (via Supabase Auth)
2. **Notification SMS** (via Twilio directly)

## 1. Authentication SMS (Already Set Up)
This is handled by Supabase Auth and is already configured for:
- Phone number verification
- Login OTP
- Password reset

No additional setup needed as it's managed through Supabase.

## 2. Notification SMS Setup
For payment confirmations, ride updates, and other notifications.

### Required Environment Variables
Add to `.env.local`:
```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=your_twilio_number
```

### Getting Twilio Credentials
1. Create a Twilio account at [twilio.com](https://www.twilio.com)
2. Get your credentials from the Twilio Console:
   - Account SID
   - Auth Token
   - Twilio Phone Number

### Testing the Service
Use sandbox mode for testing:
```typescript
const smsService = new SMSService({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: process.env.TWILIO_FROM_NUMBER!,
  environment: 'sandbox'  // Change to 'production' for live
});
```

### Available Message Templates
1. Payment Confirmation
```typescript
smsService.getPaymentConfirmationMessage({
  amount: 5000,
  provider: 'Orange Money',
  transactionId: 'tx_123',
  bookingId: 'bk_456'
});
```

2. Payment Failure
```typescript
smsService.getPaymentFailureMessage({
  amount: 5000,
  provider: 'MTN Mobile Money',
  bookingId: 'bk_456'
});
```

3. Ride Confirmation
```typescript
smsService.getRideConfirmationMessage({
  driverName: 'John',
  pickupTime: '14:30',
  bookingId: 'bk_456'
});
```

### Error Handling
The service includes:
- Sandbox mode for testing
- Detailed error messages
- Message ID tracking
- Emoji-based logging

## Security Considerations
1. Never commit `.env` files
2. Use environment variables for all credentials
3. Keep auth token secure
4. Monitor SMS usage for unusual patterns

## Troubleshooting
1. Check environment variables are set
2. Verify phone number format (international format)
3. Monitor Twilio console for delivery status
4. Check logs for emoji indicators:
   - 📱 Success
   - 🔴 Error
   - 🏖️ Sandbox mode

---
Last Updated: March 4, 2025
