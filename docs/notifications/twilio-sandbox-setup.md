# Setting Up Twilio SMS in Development/Sandbox Environment

This guide will help you get Twilio SMS working in your development environment for testing payment notifications.

## 1. Configure Your Environment Variables

Add the following to your `.env.local` file:

```
TWILIO_ACCOUNT_SID=ACccc22b6a763071fbad4b3181f925a053
TWILIO_AUTH_TOKEN=b0e5c4c8c7b5f5856adf7ed95e482168
TWILIO_FROM_NUMBER=+YOUR_TWILIO_PHONE_NUMBER  # Add your Twilio phone number here
TWILIO_ENVIRONMENT=production
```

**Important:** You need to get a phone number from your Twilio account to use as the `TWILIO_FROM_NUMBER`.

## 2. Get a Twilio Phone Number

1. Log in to the [Twilio Console](https://console.twilio.com)
2. Navigate to "Phone Numbers" → "Manage" → "Active numbers"
3. If you don't have a number, click "Buy a number" or "Get a trial number"
4. Select a number with SMS capabilities
5. Add this number to your `.env.local` file

## 3. Verify Your Personal Phone Numbers

For trial accounts, you need to verify any phone numbers you want to send SMS to:

1. Go to [Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified) in the Twilio Console
2. Click "Add a new Caller ID"
3. Enter your phone number and follow the verification process

## 4. Send Test SMS

Here's a small test script you can use to verify your Twilio setup:

```javascript
// Save as test-sms.js in your project root
const SMSService = require('./lib/notifications/sms-service').SMSService;

const smsService = new SMSService({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_FROM_NUMBER,
  environment: 'production' // Force production mode for testing
});

async function sendTestSMS() {
  const result = await smsService.sendMessage({
    to: '+YOUR_PHONE_NUMBER',  // Replace with your verified phone number
    message: 'PikDrive test message: SMS functionality is working! 🚗'
  });
  
  console.log('SMS Result:', result);
}

sendTestSMS();
```

Run the test with:
```
node -r dotenv/config test-sms.js
```

## 5. Troubleshooting

### SMS Not Being Sent
- Check Twilio console for error messages
- Ensure your phone number is verified (for trial accounts)
- Confirm you have enough Twilio credit

### Error Codes
- 21211: Invalid 'To' phone number
- 21608: Phone number not verified (trial accounts only)
- 21610: Message body too long
- 20003: Insufficient funds

## 6. Moving to Production

When you're ready to move to production:

1. Upgrade your Twilio account
2. Purchase a phone number with SMS capabilities
3. Update your environment variables
4. Set up a messaging service for better deliverability

See `docs/notifications/twilio-production-setup.md` for detailed production setup.
