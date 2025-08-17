# Environment Variables Setup Guide

## 🔑 Required Environment Variables

Create a `.env.local` file in your project root with the following variables:

### Push Notifications

```env
# VAPID Keys for Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BOMea1XVc07az4qon-sfhQF_61RohAHZjf1_0ZFhLdJm-tgxo53Z-5rmayns-RPmH7bIBcn0fG7kIrAgo-UjUpg
VAPID_PRIVATE_KEY=2Y7Beab3Qg1fHo5uEjHDcv4r3XVPAWvp9R2U2lyoKfM
```

### Supabase Configuration

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Twilio Configuration (Optional)

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=your_twilio_phone_number
```

## 🚀 How to Get VAPID Keys

### Option 1: Use Generated Keys (Recommended for Development)

The VAPID keys above were generated for this project and can be used for development.

### Option 2: Generate New Keys

If you want to generate new keys:

```bash
# Install web-push globally (if you want to generate new keys)
npm install -g web-push

# Generate new VAPID keys
web-push generate-vapid-keys
```

## 📱 Testing Push Notifications

1. **Enable Push Notifications:**

   - Go to `/messages` page
   - Click "Activer Push" button
   - Grant notification permission

2. **Test Notifications:**
   - Use the test component (development mode)
   - Send test notifications
   - Check browser console for debugging

## 🔒 Security Notes

- **Never commit** `.env.local` to version control
- **VAPID Private Key** should be kept secret
- **VAPID Public Key** is safe to expose (used in frontend)
- Use different keys for development and production

## 🌍 Production Deployment

For production, you should:

1. Generate new VAPID keys
2. Update environment variables
3. Ensure HTTPS is enabled
4. Test push notifications thoroughly
5. Monitor notification delivery rates

## 🧪 Development Testing

The current setup includes:

- Development test component
- Console logging for debugging
- Error handling and fallbacks
- Service worker debugging
