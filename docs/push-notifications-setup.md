# Push Notifications Setup Guide

## 🔑 Environment Variables

Add these to your `.env.local` file:

```env
# Push Notification VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BOMea1XVc07az4qon-sfhQF_61RohAHZjf1_0ZFhLdJm-tgxo53Z-5rmayns-RPmH7bIBcn0fG7kIrAgo-UjUpg
VAPID_PRIVATE_KEY=2Y7Beab3Qg1fHo5uEjHDcv4r3XVPAWvp9R2U2lyoKfM
```

## 🚀 Implementation Steps

### 1. Database Setup

Run the migration to create the `push_subscriptions` table:

```sql
-- This is already created in supabase/migrations/20250115_add_push_subscriptions.sql
```

### 2. Service Worker

The custom service worker is created at `public/sw-custom.js` and handles:

- Push notification events
- Notification clicks
- Background sync
- Offline support

### 3. API Routes

- `/api/push/subscribe` - Store push subscriptions
- `/api/push/send` - Send push notifications

### 4. Frontend Integration

- `useServiceWorker` hook for service worker management
- `PushNotificationService` for push notification operations
- Updated messages page with push notification controls

## 🔔 Usage

### Sending Push Notifications

```typescript
// Send a push notification to a user
const response = await fetch("/api/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "user-uuid",
    title: "New Message",
    body: "You have a new message from John",
    data: { messageId: "msg-uuid" },
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: "message",
    actions: [
      { action: "open", title: "Open", icon: "/icons/icon-72x72.png" },
      { action: "close", title: "Close", icon: "/icons/icon-72x72.png" },
    ],
  }),
});
```

### Testing Push Notifications

1. Enable push notifications in the messages page
2. Use the browser's developer tools to test
3. Check the service worker console for debugging

## 🧪 Testing

### Manual Testing

1. Open the messages page
2. Click "Activer Push" button
3. Grant notification permission
4. Check browser console for success messages

### Service Worker Testing

1. Open Chrome DevTools
2. Go to Application > Service Workers
3. Check if `sw-custom.js` is registered
4. Test push notifications via console

## 🔧 Troubleshooting

### Common Issues

1. **Service Worker not registering**: Check browser console for errors
2. **Push notifications not working**: Verify VAPID keys are correct
3. **Permission denied**: Check browser notification settings
4. **Subscription failed**: Verify service worker is ready

### Debug Commands

```javascript
// Check service worker status
navigator.serviceWorker.getRegistrations().then(console.log);

// Check push manager
navigator.serviceWorker.ready.then((reg) =>
  reg.pushManager.getSubscription().then(console.log)
);

// Test push notification
fetch("/api/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "your-user-id",
    title: "Test",
    body: "Test notification",
  }),
});
```

## 📱 Mobile Support

### PWA Installation

- Push notifications work in installed PWA
- Background sync for offline scenarios
- Native-like notification experience

### Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Limited support (iOS 16.4+)
- Mobile browsers: Varies by platform


















