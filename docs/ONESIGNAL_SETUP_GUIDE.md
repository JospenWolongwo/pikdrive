# OneSignal + Supabase Edge Functions Setup Guide

## 🎯 What You're Building

Professional, enterprise-grade notification system used by Uber, DoorDash, and Shopify.

**Result**: Multi-platform notifications (Web, iOS, Android) with 99.9% uptime and built-in analytics.

---

## 📋 Prerequisites

- [ ] Supabase project
- [ ] OneSignal account (free)
- [ ] 30 minutes of time

---

## 🚀 Step 1: OneSignal Setup (10 minutes)

### 1.1 Create OneSignal Account

1. Go to [https://onesignal.com](https://onesignal.com)
2. Click "Get Started Free"
3. Sign up with email or Google

### 1.2 Create New App

1. Click "New App/Website"
2. Name: "PikDrive"
3. Select platforms:
   - ☑️ Web Push
   - ☑️ Apple iOS (if you have iOS app)
   - ☑️ Google Android (if you have Android app)

### 1.3 Web Push Configuration

1. Select "Web Push" platform
2. Choose "Typical Site" (not WordPress)
3. Enter your site details:
   ```
   Site Name: PikDrive
   Site URL: https://your-domain.com (or http://localhost:3000 for dev)
   Auto Resubscribe: ☑️ Enabled
   Default Notification Icon URL: https://your-domain.com/icons/icon-192x192.png
   ```
4. Click "Save"

### 1.4 Advanced Push Settings (Optional but Recommended)

#### 1.4.1 Webhooks (Recommended)
1. Go to **Settings** → **Webhooks**
2. Enable webhooks: **☑️ YES**
3. Set webhook URLs:
   - **Ping this URL when a notification is displayed**: `https://pikdrive.com/api/webhooks/onesignal`
   - **Ping this URL when a notification is clicked**: `https://pikdrive.com/api/webhooks/onesignal`
   - **Ping this URL when a notification is dismissed**: `https://pikdrive.com/api/webhooks/onesignal`
4. **CORS request headers**: **☑️ ENABLE**
   - This allows OneSignal to make cross-origin requests to your webhook
   - Essential for webhook functionality
5. Select events:
   - ☑️ Notification Sent
   - ☑️ Notification Clicked
   - ☑️ Notification Failed
6. Click **Save**

**Why**: Track delivery status and user engagement for analytics.

**Note**: Use the same endpoint for all three - the webhook handler will differentiate based on the event type.

#### 1.4.2 Service Workers (Web Push Only)
1. Go to **Settings** → **Web Push** → **Service Workers**
2. Configure these fields:
   - **Path to service worker files**: `/` (root directory)
   - **Main service worker filename**: `OneSignalSDKWorker.js` (default)
   - **Updater service worker filename**: `OneSignalSDKUpdaterWorker.js` (default)
   - **Service worker registration scope**: `/` (root directory)
3. **Keep all defaults** unless you have existing service workers

**Why**: 
- Defaults work perfectly for most apps
- Root scope (`/`) ensures notifications work across your entire site
- OneSignal handles service worker management automatically
- No conflicts with existing PWA service workers

**⚠️ Important**: If you already have a service worker at `/sw.js`, OneSignal will automatically merge with it. No manual configuration needed.

#### 1.4.3 Click Behavior (Important for UX)
1. Go to **Settings** → **Web Push** → **Click Behavior**
2. Configure these settings:
   - **Matching Strategy**: **Origin** (Take action on a previous tab open in same domain)
   - **Action Strategy**: **Focus** (Focus on existing tab)
3. Set Default URL: `https://pikdrive.com` (your app homepage)
4. Click **Save**

**Why**: 
- **Origin + Focus** provides the best user experience for web apps
- Opens PikDrive in existing tab instead of creating new windows
- Users stay in their current session and don't lose context
- Prevents multiple tabs of the same app

**Alternative**: If you prefer new windows, use **Exact + Navigate**, but **Origin + Focus** is recommended for web apps.

#### 1.4.4 Persistence (Better UX)
1. Go to **Settings** → **Web Push** → **Persistence**
2. Enable: **☑️ Notifications remain on screen until clicked**
3. Click **Save**

**Why**: Users won't miss important notifications.

#### 1.4.5 Safari Certificate (iOS Only - Skip for Web)
- **Skip this** if you only have web app
- Only needed for iOS Safari push notifications
- Requires Apple Developer account and certificate

### 1.5 Get API Credentials

1. Go to **Settings** → **Keys & IDs**
2. You'll see:
   - ✅ **OneSignal App ID**: Already displayed (copy this)
   - ❌ **REST API Key**: Shows "Create" button

3. **Create REST API Key**:
   - Click the **"Create"** button next to REST API Key
   - OneSignal will generate a long API key
   - **Copy this immediately** - you won't be able to see it again!

4. Save both values safely:
   ```
   OneSignal App ID: 144cd70b-0d97-4216-8cff-80d1c903b93d
   REST API Key: [Your generated key - starts with letters/numbers]
   ```

5. **⚠️ IMPORTANT**: 
   - REST API Key is like a password - keep it secret!
   - Never expose it in your frontend code
   - Only use it in server-side code (Edge Functions)
   - Don't share it on GitHub or anywhere public

6. Keep these safe - you'll need them for environment variables!

---

## 🔧 Step 2: Environment Variables (2 minutes)

Add to your `.env.local`:

```env
# OneSignal Configuration
ONESIGNAL_APP_ID=144cd70b-0d97-4216-8cff-80d1c903b93d
ONESIGNAL_API_KEY=your_generated_rest_api_key_here

# Supabase (if not already set)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Replace `your_generated_rest_api_key_here` with the REST API key you just created!**

**Get Supabase Service Role Key:**
1. Go to Supabase Dashboard
2. Settings → API
3. Copy "service_role" key (not anon key!)

---

## 🪝 Step 2.5: Create Webhook Endpoint (Optional - For Analytics)

### 2.5.1 Create Webhook Route

Create `app/api/webhooks/onesignal/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const body = await request.json();

    // Log webhook event for analytics
    const { error } = await supabase
      .from('onesignal_webhook_logs')
      .insert({
        event_type: body.type,
        notification_id: body.notification?.id,
        user_id: body.notification?.external_user_id,
        data: body,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Webhook logging error:', error);
    }

    // Handle different event types
    switch (body.type) {
      case 'notification_sent':
        console.log('📤 Notification sent:', body.notification?.id);
        break;
      case 'notification_clicked':
        console.log('👆 Notification clicked:', body.notification?.id);
        // Optional: Track user engagement
        break;
      case 'notification_failed':
        console.log('❌ Notification failed:', body.notification?.id);
        // Optional: Alert monitoring system
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

### 2.5.2 Create Webhook Logs Table

Run this SQL in Supabase:

```sql
-- Create webhook logs table
CREATE TABLE IF NOT EXISTS onesignal_webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  notification_id TEXT,
  user_id TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE onesignal_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert
CREATE POLICY "Service role can insert webhook logs" 
ON onesignal_webhook_logs 
FOR INSERT 
TO service_role 
USING (true);

-- Allow authenticated users to read their own logs
CREATE POLICY "Users can read own webhook logs" 
ON onesignal_webhook_logs 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid()::text);
```

---

## 🧠 **Understanding Edge Functions & Webhooks (Essential Knowledge)**

### **What Are Edge Functions?** 🌐

**Edge Functions** are serverless functions that run close to your users worldwide. Think of them as mini-servers that execute your code in multiple locations.

#### **Real-World Examples:**
- **Netflix**: Uses Edge Functions to serve personalized content from servers near users
- **Stripe**: Processes payments using Edge Functions for low latency
- **Uber**: Sends notifications instantly using Edge Functions worldwide

#### **Why Use Edge Functions for Notifications?**
1. **⚡ Speed**: Code runs in 100+ locations worldwide (closer to users)
2. **🔒 Security**: API keys stay on server-side (never exposed to browsers)
3. **📈 Scalability**: Automatically handles millions of requests
4. **💰 Cost**: Pay only when used (not running 24/7)
5. **🛠️ Maintenance**: No server management needed

### **What Are Webhooks?** 🪝

**Webhooks** are HTTP callbacks that notify your app when events happen. It's like having a phone number that gets called when something important occurs.

#### **Real-World Examples:**
- **GitHub**: Calls your webhook when code is pushed
- **Stripe**: Notifies your app when payment is completed
- **OneSignal**: Tells your app when notification was sent/clicked

#### **Why Use Webhooks for Analytics?**
1. **📊 Real-time tracking**: Know immediately when events happen
2. **🎯 User engagement**: Track who clicked notifications
3. **📈 Performance metrics**: Monitor delivery rates
4. **🚨 Error handling**: Detect failed notifications instantly

### **How They Work Together** 🔄

```
User Action → Edge Function → OneSignal → Webhook → Your Database
    ↓              ↓             ↓          ↓           ↓
  Payment      Send Notif    Delivers    Tracks     Analytics
  Complete     via API       to User     Events     Dashboard
```

#### **Step-by-Step Flow:**
1. **User completes payment** in your app
2. **Edge Function** sends notification via OneSignal API
3. **OneSignal** delivers notification to user's device
4. **Webhook** tells your app: "Notification sent/clicked/failed"
5. **Your database** stores analytics for reporting

### **Industry Best Practices** 🏆

#### **Companies Using This Architecture:**
- **Uber**: Edge Functions + Webhooks for ride notifications
- **DoorDash**: Order updates via Edge Functions worldwide
- **Airbnb**: Booking confirmations with real-time analytics
- **Spotify**: Music recommendations with engagement tracking

#### **Why This is Professional:**
1. **Separation of Concerns**: Each service has one job
2. **Fault Tolerance**: If one part fails, others continue working
3. **Observability**: Track everything for debugging
4. **Scalability**: Handles growth automatically
5. **Security**: Sensitive data stays server-side

---

## 📦 Step 3: Deploy Edge Function (5 minutes)

### 3.1 Install Supabase CLI (Step-by-Step Guide)

#### Option 1: Using npm (Recommended - Works on all platforms)
```bash
# Install globally via npm
npm install -g supabase

# Verify installation
supabase --version
```

#### Option 2: Using Package Managers

**Windows (PowerShell):**
```bash
# Install Scoop first (if not installed)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Then install Supabase CLI
scoop install supabase
```

**Mac (Homebrew):**
```bash
# Install Homebrew first (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install Supabase CLI
brew install supabase/tap/supabase
```

#### Verify Installation
```bash
supabase --version
# Should show: supabase version 1.x.x
```

### 3.2 Login to Supabase

```bash
# This will open your browser for authentication
supabase login
```

**What happens:**
1. CLI opens your browser
2. You'll be redirected to Supabase website
3. Sign in with your Supabase account
4. Grant permission to CLI
5. You'll see "Successfully logged in!" message

### 3.3 Find Your Project Reference ID

**Method 1: From Supabase Dashboard**
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click on your PikDrive project
3. Go to **Settings** → **General**
4. Copy the **Reference ID** (looks like: `abcdefghijklmnop`)

**Method 2: From Project URL**
- If your project URL is: `https://supabase.com/dashboard/project/abcdefghijklmnop`
- Your project-ref is: `abcdefghijklmnop`

### 3.4 Link Your Project

```bash
# Replace 'your-project-ref' with your actual reference ID
supabase link --project-ref your-project-ref
```

**Example:**
```bash
supabase link --project-ref abcdefghijklmnop
```

**What happens:**
1. CLI connects to your Supabase project
2. Downloads project configuration
3. Creates/updates `.supabase/config.toml` file
4. Shows "Linked to project abcdefghijklmnop"

### 3.5 Verify Connection

```bash
# Check if you're properly linked
supabase status
```

**Expected output:**
```
API URL: https://abcdefghijklmnop.supabase.co
DB URL: postgresql://postgres:[password]@db.abcdefghijklmnop.supabase.co:5432/postgres
Studio URL: https://supabase.com/dashboard/project/abcdefghijklmnop
Inbucket URL: https://abcdefghijklmnop.supabase.co/functions/v1/_supabase/functions/inbucket
JWT secret: [secret]
anon key: [key]
service_role key: [key]
```

### 3.6 Fix Configuration Issues

#### **Issue 1: Docker Not Running**
If you see Docker connection errors:
```bash
# Error: failed to inspect container health: error during connect
```

**Solutions:**
1. **Start Docker Desktop** on your machine
2. **Wait for Docker to fully start** (check system tray)
3. **Restart terminal** after Docker starts

#### **Issue 2: Database Version Warning**
If you see a warning about database version, it's already fixed in the config:
```toml
[db]
major_version = 15
```

#### **Issue 3: Twilio SMS Configuration**
Since you're using Twilio for OTP, the config is already set up:
```toml
[auth.sms.twilio]
enabled = true
account_sid = "env(SUPABASE_AUTH_SMS_TWILIO_ACCOUNT_SID)"
message_service_sid = "env(SUPABASE_AUTH_SMS_TWILIO_MESSAGE_SERVICE_SID)"
auth_token = "env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)"
```

**Note**: Make sure your Twilio environment variables are set in your `.env.local` file.

### 3.7 Set Edge Function Secrets

```bash
supabase secrets set ONESIGNAL_APP_ID=144cd70b-0d97-4216-8cff-80d1c903b93d
supabase secrets set ONESIGNAL_API_KEY=your_generated_rest_api_key_here
```

**Replace `your_generated_rest_api_key_here` with your actual REST API key!**

### 3.8 Deploy Edge Function

```bash
supabase functions deploy send-notification
```

**You should see:**
```
✅ Deployed Function send-notification
🌐 URL: https://lvtwvyxolrjbupltmqrl.supabase.co/functions/v1/send-notification
```

**What this does:**
1. **Uploads** your Edge Function code to Supabase
2. **Creates** a secure serverless endpoint
3. **Deploys** to 100+ locations worldwide
4. **Returns** the public URL for your function

---

## 💾 Step 4: Database Setup (2 minutes)

### Run Migration

```bash
# From your project root
supabase migration up
```

Or run the SQL directly in Supabase SQL Editor:
```sql
-- Copy contents from supabase/migrations/20250131_add_notification_logs.sql
```

This creates the `notification_logs` table for analytics.

---

## 🧪 Step 5: Test the Setup (5 minutes)

### 5.1 Test Edge Function Directly

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/send-notification' \
  -H 'Authorization: Bearer your_service_role_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "test-user-123",
    "title": "Test Notification",
    "message": "This is a test from PikDrive!",
    "notificationType": "test"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "notificationId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "recipients": 0
}
```

Note: `recipients: 0` is normal if user hasn't subscribed yet.

### 5.2 Check Logs

```bash
supabase functions logs send-notification
```

---

## 🔗 Step 6: Update Payment Service (5 minutes)

Replace the HTTP loop in `payment-notification-service.ts`:

```typescript
import { ServerOneSignalNotificationService } from './onesignal-notification-service';

export class ServerPaymentNotificationService {
  private notificationService: ServerOneSignalNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.notificationService = new ServerOneSignalNotificationService(supabase);
  }

  async notifyPaymentCompleted(payment: Payment): Promise<void> {
    try {
      // Get booking details
      const { data: booking } = await this.supabase
        .from('bookings')
        .select('user_id, ride_id')
        .eq('id', payment.booking_id)
        .single();

      if (!booking) return;

      // Send via OneSignal Edge Function (NO HTTP LOOP!)
      await this.notificationService.sendPaymentNotification(
        booking.user_id,
        payment.id,
        'completed',
        payment.amount
      );

      console.log('✅ Payment notification sent');
    } catch (error) {
      console.error('Error sending payment notification:', error);
      // Don't throw - notifications are non-critical
    }
  }
}
```

---

## 📱 Step 7: Frontend Integration (Optional - For Web Push)

### 7.1 Install OneSignal SDK

```bash
npm install react-onesignal
```

### 7.2 Initialize in App

```typescript
// app/layout.tsx
import OneSignal from 'react-onesignal';

export default function RootLayout({ children }) {
  useEffect(() => {
    OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
      allowLocalhostAsSecureOrigin: true, // For development
    }).then(() => {
      console.log('✅ OneSignal initialized');
    });
  }, []);

  return <html>{children}</html>;
}
```

### 7.3 Set External User ID

```typescript
// After user login
import OneSignal from 'react-onesignal';

const handleLogin = async (user) => {
  // ... your login logic

  // Set user ID in OneSignal
  await OneSignal.setExternalUserId(user.id);
  console.log('✅ OneSignal user ID set');
};
```

### 7.4 Verify OneSignal Files

After adding the SDK, you should see these files in your project root:
- ✅ `OneSignalSDKWorker.js` - Service worker for push notifications
- ✅ `._OneSignalSDK-v16-ServiceWorker` - Version tracking file

**File Usage:**
- **OneSignalSDKWorker.js**: Handles background push notifications when app is closed
- **._OneSignalSDK-v16-ServiceWorker**: Version control file (can be ignored in git)

**Note**: These files are automatically generated by OneSignal SDK and should be committed to your repository.

---

## 👤 Step 8: Add Your First User (User Subscription)

### 8.1 What This Step Means

**"Add your first user"** means getting a user to **subscribe to push notifications** on your website. This is the process where:

1. User visits your website (`https://pikdrive.com`)
2. OneSignal SDK automatically prompts for notification permission
3. User clicks "Allow" to subscribe
4. User becomes visible in OneSignal dashboard

### 8.2 How It Works

#### Automatic Prompt (Default Behavior)
```typescript
// OneSignal automatically shows this prompt on first visit:
// "pikdrive.com wants to show notifications"
// [Block] [Allow]
```

#### Manual Prompt (Recommended for Better UX)
```typescript
// In your app, add a custom notification permission button
const requestNotificationPermission = async () => {
  try {
    const permission = await OneSignal.showNativePrompt();
    if (permission) {
      console.log('✅ User subscribed to notifications');
      // Set user ID after subscription
      await OneSignal.setExternalUserId(currentUser.id);
    }
  } catch (error) {
    console.error('Notification permission error:', error);
  }
};

// Add this button to your UI
<button onClick={requestNotificationPermission}>
  Enable Notifications
</button>
```

### 8.3 Testing the Subscription

#### Method 1: Visit Your Website
1. Open `https://pikdrive.com` in a new browser tab
2. Look for the notification permission prompt
3. Click "Allow"
4. Check OneSignal dashboard → **Audience** → **All Users**

#### Method 2: Use Browser Dev Tools
```javascript
// Open browser console on pikdrive.com and run:
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
  await OneSignal.showNativePrompt();
});
```

### 8.4 Verify Subscription Success

#### Check OneSignal Dashboard
1. Go to OneSignal Dashboard
2. Navigate to **Audience** → **All Users**
3. You should see your browser/device listed
4. **External User ID** will be empty until you set it programmatically

#### Check Browser Settings
1. Chrome: Settings → Privacy and Security → Site Settings → Notifications
2. Find `pikdrive.com` in the list
3. Should show "Allow" status

### 8.5 Set External User ID (Important!)

After subscription, link the user to your app:

```typescript
// After user logs in to your app
const handleUserLogin = async (user) => {
  // Set OneSignal external user ID to your app's user ID
  await OneSignal.setExternalUserId(user.id);
  
  // Now you can send targeted notifications to this user
  console.log('✅ User linked to OneSignal');
};
```

### 8.6 Troubleshooting Subscription

#### No Permission Prompt Appears
- Check browser notification settings
- Try incognito/private browsing mode
- Clear browser cache and cookies
- Ensure HTTPS (required for notifications)

#### Permission Denied
- User clicked "Block" - they need to manually enable in browser settings
- Browser blocked notifications globally
- Site not on HTTPS

#### User Not Appearing in Dashboard
- Wait 1-2 minutes for OneSignal to sync
- Refresh the OneSignal dashboard
- Check browser console for errors

---

## ✅ Verification Checklist

Test each item:

- [ ] OneSignal account created
- [ ] App configured in OneSignal dashboard
- [ ] **Advanced Settings Configured:**
  - [ ] Webhooks enabled (optional but recommended)
  - [ ] Click behavior set to navigate to URL
  - [ ] Persistence enabled (notifications stay until clicked)
  - [ ] Service worker settings (keep defaults)
- [ ] Environment variables set
- [ ] Webhook endpoint created (if using webhooks)
- [ ] Edge function deployed successfully
- [ ] Database migration run
- [ ] Test notification sent via curl
- [ ] Payment service updated
- [ ] Frontend SDK initialized (if web push)
- [ ] Test end-to-end notification flow

---

## 🎯 Testing End-to-End

### 1. Subscribe User (Frontend)

```typescript
// In your app
import OneSignal from 'react-onesignal';

const subscribeButton = () => {
  const handleSubscribe = async () => {
    await OneSignal.setExternalUserId(currentUser.id);
    console.log('✅ Subscribed to notifications');
  };

  return <button onClick={handleSubscribe}>Enable Notifications</button>;
};
```

### 2. Trigger Notification (Backend)

```typescript
// In your payment route after successful payment
const notificationService = new ServerOneSignalNotificationService(supabase);

await notificationService.sendPaymentNotification(
  userId,
  paymentId,
  'completed',
  amount
);
```

### 3. Check Delivery

1. **OneSignal Dashboard**: Go to Messages → Sent Messages
2. **Your Database**: Check `notification_logs` table
3. **User Device**: Should receive notification!

---

## 📊 Analytics Dashboard

### View in OneSignal

1. Go to OneSignal Dashboard
2. Navigate to **Messages** → **Sent Messages**
3. See:
   - Delivery Rate
   - Click Rate
   - Conversion Rate
   - Platform breakdown

### Query Your Database

```sql
-- Total notifications sent
SELECT COUNT(*) FROM notification_logs;

-- Notifications by type
SELECT notification_type, COUNT(*) 
FROM notification_logs 
GROUP BY notification_type;

-- Delivery rate
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
  ROUND(100.0 * SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) / COUNT(*), 2) as delivery_rate
FROM notification_logs;
```

---

## 🐛 Troubleshooting

### Edge Function Not Deploying

```bash
# Check function logs
supabase functions logs send-notification --limit 100

# Verify secrets are set
supabase secrets list

# Re-deploy
supabase functions deploy send-notification --no-verify-jwt
```

### Notifications Not Sending

1. **Check OneSignal Dashboard**
   - Messages → Sent Messages
   - Look for errors

2. **Check Edge Function Logs**
   ```bash
   supabase functions logs send-notification
   ```

3. **Verify User is Subscribed**
   - OneSignal Dashboard → Audience → All Users
   - Search for External User ID

4. **Test with OneSignal Tester**
   - Dashboard → Messages → New Push
   - Send to: Particular Users
   - Enter External User ID

### Permission Denied

- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Verify RLS policies on `notification_logs` table

### Webhook Issues

1. **Webhook not receiving events**
   - Check webhook URL is accessible: `curl -X POST https://pikdrive.com/api/webhooks/onesignal`
   - Verify HTTPS (required by OneSignal)
   - Check OneSignal dashboard → Settings → Webhooks for delivery status

2. **Notifications not opening app**
   - Verify Click Behavior settings
   - Check Default URL is correct
   - Test with different browsers

3. **Service Worker conflicts**
   - If you have existing service worker, check for conflicts
   - OneSignal will handle this automatically in most cases
   - Check browser console for errors

---

## 💰 Cost Breakdown

### OneSignal Free Tier
- ✅ Up to 10,000 subscribers: **FREE**
- ✅ Unlimited notifications
- ✅ All platforms included
- ✅ Basic analytics

### After Free Tier
- $9/month: Up to 30,000 subscribers
- $49/month: Up to 100,000 subscribers
- Enterprise: Custom pricing

### Supabase Edge Functions
- ✅ First 500,000 invocations: **FREE**
- ✅ 2GB bandwidth included
- $2 per additional 1M invocations

**Most apps stay FREE for months!**

---

## 📚 Additional Resources

### OneSignal Docs
- [Web Push Quickstart](https://documentation.onesignal.com/docs/web-push-quickstart)
- [API Reference](https://documentation.onesignal.com/reference/create-notification)
- [Best Practices](https://documentation.onesignal.com/docs/best-practices)

### Supabase Docs
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Database Webhooks](https://supabase.com/docs/guides/database/webhooks)

### PikDrive Docs
- [Architecture Analysis](./NOTIFICATION_ARCHITECTURE_ANALYSIS.md)
- [Migration Guide](./NOTIFICATION_MIGRATION_GUIDE.md)

---

## 🎉 Success!

You now have an **enterprise-grade notification system** with:
- ✅ 99.9% uptime SLA
- ✅ Multi-platform support
- ✅ Built-in analytics
- ✅ Minimal maintenance
- ✅ Professional infrastructure

**Next**: Start migrating your existing notification calls to use `ServerOneSignalNotificationService`!

---

**Setup Time**: ~30 minutes  
**Maintenance**: <1 hour/month  
**Cost**: FREE for most apps  
**Result**: Professional notifications like Uber 🚀
