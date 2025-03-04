# Getting MTN MOMO API Credentials - Step by Step Guide

## Step 1: Register as a Developer
1. Visit [MTN MOMO Developer Portal](https://momodeveloper.mtn.com)
2. Click "Sign Up" to create a new account
3. Fill in your details:
   - Use your business email
   - Company name: PikDrive
   - Select country: Cameroon
   - Choose primary API product: Collection
4. Verify your email address

## Step 2: Create a Sandbox Environment
1. Log in to your developer account
2. Go to "My Apps" section
3. Click "Create New App"
4. Fill in app details:
   - Name: PikDrive
   - Primary Product: Collection
   - Use Case: Ride Payment Collection
   - Callback URL: (We'll set this up later)

## Step 3: Get Your Primary Subscription Key
This is your `MOMO_SUBSCRIPTION_KEY`
1. In your app dashboard, find "Subscription Keys"
2. Copy the "Primary Key"
3. This key is used for all API requests

## Step 4: Generate API User and API Key
For `MOMO_COLLECTION_USER_ID` and `MOMO_API_KEY`:

1. Generate API User:
```bash
# Use Postman or curl to make this request
curl -X POST https://sandbox.momodeveloper.mtn.com/v1_0/apiuser
-H "X-Reference-Id: [generate-uuid]"
-H "Ocp-Apim-Subscription-Key: [your-subscription-key]"
-H "Content-Type: application/json"
-d '{
  "providerCallbackHost": "https://pikdrive.com"
}'
```
- The X-Reference-Id you generate becomes your `MOMO_COLLECTION_USER_ID`

2. Generate API Key:
```bash
# After creating API user, get the API key
curl -X POST https://sandbox.momodeveloper.mtn.com/v1_0/apiuser/[api-user-id]/apikey
-H "Ocp-Apim-Subscription-Key: [your-subscription-key]"
```
- The response contains your `MOMO_API_KEY`

## Step 5: Get Collection Primary Key
For `MOMO_COLLECTION_PRIMARY_KEY`:
1. Go to "Products" > "Collection"
2. Find "Subscription Keys"
3. Copy the "Primary Key"

## Step 6: Test Environment Variables
Your final `.env` should have:
```env
MOMO_SUBSCRIPTION_KEY=your-subscription-key
MOMO_COLLECTION_PRIMARY_KEY=your-collection-primary-key
MOMO_COLLECTION_USER_ID=your-api-user-id
MOMO_API_KEY=your-api-key
MOMO_TARGET_ENVIRONMENT=sandbox
MOMO_CALLBACK_HOST=https://your-callback-url.com
```

## Step 7: Test Phone Numbers
For sandbox testing, use these test numbers:
- MTN Test Number: +237670000000
- Default PIN: 0000

## Important Notes
1. Keep these credentials secure
2. Never commit them to version control
3. The sandbox environment is free to use
4. Test thoroughly before going to production

## Next Steps
1. Set up a local tunnel for testing (ngrok)
2. Configure webhook URL
3. Run test transactions
4. Monitor sandbox dashboard

## Troubleshooting
If you encounter issues:
1. Verify all credentials are correct
2. Ensure you're using the sandbox URL
3. Check API request headers
4. Monitor the developer portal logs

Need help? Contact:
- MTN MOMO Support: support@momodeveloper.mtn.com
- Developer Forum: https://momodeveloper.mtn.com/forum
