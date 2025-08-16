# Notification Troubleshooting Guide

## 🚨 Common Issue: Permission Denied

### Symptoms

- Console shows: `🔐 Notification permission: false`
- Console shows: `❌ Notification permission denied`
- Toggle button doesn't work
- No notifications appear

### Root Cause

The browser has **blocked** notifications for this site, either:

1. User clicked "Block" when first prompted
2. Browser automatically blocked due to security settings
3. Site was added to notification blocklist

### ✅ Solution Steps

#### Step 1: Check Browser Permission

1. Look for a **🔒 lock icon** or **ⓘ info icon** in the browser address bar
2. Click on it to open site settings
3. Find "Notifications" setting
4. Change from **"Block"** to **"Allow"**

#### Step 2: Refresh and Test

1. **Refresh the page** (F5 or Ctrl+R)
2. Go to `/messages` page
3. Click the notification toggle button
4. You should see a browser permission popup

#### Step 3: Use Debug Tools (Development)

1. Scroll down to see the **"🐛 Debug Notifications"** card
2. Check the permission status
3. Use the test buttons to verify functionality

### 🔧 Browser-Specific Instructions

#### Chrome/Edge

1. Click the **🔒** icon in the address bar
2. Click **"Site settings"**
3. Under "Permissions", find **"Notifications"**
4. Change to **"Allow"**
5. Refresh the page

#### Firefox

1. Click the **🔒** icon in the address bar
2. Click **"Connection is secure"** → **"More Information"**
3. Go to **"Permissions"** tab
4. Find **"Receive Notifications"**
5. Uncheck **"Use Default"** and select **"Allow"**
6. Refresh the page

#### Safari

1. Go to **Safari** → **Settings** → **Websites**
2. Click **"Notifications"** in the left sidebar
3. Find your site and change to **"Allow"**
4. Refresh the page

## 🔧 Debug Console Commands

### Check Current State

```javascript
// Check if notifications are supported
console.log("Supported:", "Notification" in window);

// Check current permission
console.log("Permission:", Notification.permission);

// Check service state
console.log("Service enabled:", window.notificationService?.isEnabled());
```

### Test Notifications

```javascript
// Test basic notification
window.testNotifications();

// Test visibility notifications
const cleanup = window.testVisibilityNotifications();
// cleanup() to stop testing
```

### Check Queue Status

```javascript
// See queued notifications
console.log("Queue:", window.notificationQueue?.getQueueStatus());

// Clear queue
window.notificationQueue?.clear();
```

## 🎯 Expected Console Output (Working)

```
🔐 Notification service permission check: {permission: "granted", granted: true}
🔔 Setting up global message notification manager
📡 Global message notification subscription status: SUBSCRIBED
```

## 🚨 Expected Console Output (Blocked)

```
🔐 Notification service permission check: {permission: "denied", granted: false}
❌ Notification permission was previously denied
💡 To enable notifications:
1. Click the 🔒 or ⓘ icon in the browser address bar
2. Change notifications from 'Block' to 'Allow'
3. Refresh the page and try again
```

## 🐛 Advanced Debugging

### Check Audio Issues

1. Open browser dev tools (F12)
2. Go to **Network** tab
3. Refresh page and look for `/notification.wav`
4. Should see **200 OK** status

### Check Subscription Issues

1. Open **Console** tab
2. Look for subscription status messages
3. Should see "SUBSCRIBED" not "CLOSED" or "CHANNEL_ERROR"

### Check Message Flow

1. Send yourself a test message
2. Watch console for:
   ```
   📬 Processing new message notification
   ✅ Message notification shown successfully
   ```

## 🚀 Quick Fixes

### Reset Everything

```javascript
// Clear local storage
localStorage.clear();

// Refresh page
location.reload();
```

### Force Permission Request

```javascript
// Manually request permission
Notification.requestPermission().then((permission) => {
  console.log("Permission result:", permission);
  location.reload();
});
```

## 📞 Still Not Working?

### Fallback Options

1. **Audio-only mode**: Even if visual notifications fail, sounds should still play
2. **Queue system**: Notifications will be saved and shown when permission is granted
3. **Page refresh**: Often resolves permission state issues

### Report Issues

If following all steps doesn't work:

1. Note your browser and version
2. Copy console output
3. Check if other websites can show notifications
4. Try in an incognito/private window

## 🎉 Success Indicators

### ✅ Everything Working

- Permission status: **"✅ Accordée"**
- Test buttons work
- Notifications appear when switching tabs
- Sound plays on message reception
- Console shows subscription success messages

### ⚠️ Partial Working

- Sounds play but no visual notifications = Permission issue
- Visual notifications but no sound = Audio file issue
- No notifications at all = Subscription issue
