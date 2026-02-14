# PikDrive Notification System Overview

## Architecture

PikDrive uses a **multi-channel notification system** with three delivery channels:

```
Event (payment, booking, review request, message)
    |
    v
ServerMultiChannelNotificationService
    |
    +-- OneSignal (Push Notifications)
    |       Web Push (Chrome, Firefox, Safari)
    |       iOS / Android (via PWA)
    |
    +-- WhatsApp Business API
    |       Template messages via Meta API
    |       Supabase Edge Function (send-whatsapp-message)
    |
    +-- Browser Notifications
            Real-time chat messages
            Audio alerts
```

---

## 1. Push Notifications (OneSignal)

### Purpose
Server-to-device notifications for payment events, ride updates, booking confirmations, and review requests.

### Key Files
```
lib/services/server/
├── onesignal-notification-service.ts     # OneSignal API wrapper
├── payment-notification-service.ts       # Payment-specific notifications
└── multi-channel-notification-service.ts # Orchestrates push + WhatsApp

supabase/functions/
└── send-onesignal-notification/index.ts  # Edge Function
```

### Notification Types
- `payment_success` / `payment_failed` — Payment status changes
- `booking_confirmed` — Booking confirmation
- `driver_new_booking` — Driver receives new booking
- `review_request_passenger` / `review_request_driver` — Post-ride review requests
- `review_received` — New review received
- `new_message` — Chat message notification

### Features
- Multi-platform (Web, iOS, Android via PWA)
- Custom sounds per notification type
- French localization
- High priority for critical events
- Offline delivery queue

---

## 2. WhatsApp Business API

### Purpose
Template-based messages for payment confirmations, booking details, driver notifications, and review requests.

### Key Files
```
lib/services/server/
└── whatsapp-notification-service.ts      # WhatsApp template sender

supabase/functions/
└── send-whatsapp-message/index.ts        # Edge Function (calls Meta API)
```

### Templates
- `booking_confirmation` — Sent to passenger after payment
- `driver_new_booking` — Sent to driver for new bookings
- `review_request_passenger` — Post-ride review request (passenger)
- `review_request_driver` — Post-ride review request (driver)

### Setup
- Templates must be approved in Meta Business Manager
- Variables cannot be at start or end of template body
- See `docs/WHATSAPP_WEBHOOK_SETUP.md` for webhook configuration

### Environment Variables
```
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
META_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=pikdrive_verify
WHATSAPP_API_VERSION=v24.0
```

---

## 3. Browser Notifications (Chat)

### Purpose
Real-time chat message alerts using the Browser Notification API with Supabase real-time subscriptions.

### Key Files
```
lib/notifications/
├── notification-service.ts              # Core browser notification API
├── message-notification-manager.ts      # Chat message subscriptions
├── audio-manager.ts                     # Sound management
└── notification-queue.ts                # Offline message queue
```

### Features
- Real-time message detection via Supabase channels
- Custom audio alerts
- Vibration patterns
- Click-to-navigate to conversations
- Offline queue for missed messages

---

## Multi-Channel Orchestration

`ServerMultiChannelNotificationService` coordinates sending across channels:

```typescript
// Example: Send review request via both push + WhatsApp
await multiChannelService.sendReviewRequest({
  userId,
  phoneNumber,
  userName,
  otherPartyName,
  route,
  reviewUrl,
  bookingId,
  isDriver: false,
});
```

This sends:
1. OneSignal push notification (immediate, clickable)
2. WhatsApp template message (persistent, includes link)

---

## Cost

| Channel | Cost |
|---------|------|
| OneSignal Push | Free (up to 10K users) |
| WhatsApp | Free (1,000 conversations/month on Meta free tier) |
| Browser Notifications | Free |

---

## Adding New Notifications

1. Define the `NotificationType` in `types/notification.ts`
2. Add sound mapping in `NOTIFICATION_SOUNDS`
3. Add action URL in `NOTIFICATION_ACTIONS`
4. Implement in `ServerMultiChannelNotificationService` or the relevant service
5. Create WhatsApp template in Meta Business Manager (if WhatsApp delivery needed)
6. Add template variable count in `whatsapp-notification-service.ts`

---

## Related Documentation

- `docs/WHATSAPP_IMPLEMENTATION_SUMMARY.md` — WhatsApp integration details
- `docs/WHATSAPP_WEBHOOK_SETUP.md` — Webhook configuration
- `docs/ONESIGNAL_SETUP_GUIDE.md` — OneSignal initial setup
- `docs/NOTIFICATION_TEMPLATES.md` — Notification content templates
- `docs/NOTIFICATION_SOUNDS_GUIDE.md` — Sound configuration
- `docs/SMS_REMOVAL_SUMMARY.md` — Why SMS was removed

---
Last Updated: February 2026
