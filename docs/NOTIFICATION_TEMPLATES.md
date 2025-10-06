# 📱 Professional Notification Templates

## Overview
Clean, professional notification templates without emojis. Uses polished icons and real data values.

---

## 🎨 Lucide Icons from shadcn/ui

All icons use **Lucide React** icons (already in your project via shadcn/ui):

```typescript
import { 
  CheckCircle2,  // Payment success
  Wallet,        // Payment received (driver)
  XCircle,       // Payment failed
  Clock,         // Payment pending
  Loader2,       // Payment processing
  Ticket,        // Booking created
  TicketCheck,   // Booking confirmed
  TicketX,       // Booking cancelled
  MessageSquare  // New message
} from 'lucide-react';
```

**No PNG files needed!** Icons are passed as names in notification `data` and rendered on frontend.

---

## 💰 Payment Notifications

### **Passenger: Payment Confirmed**
```
Title: "Payment Confirmed"
Message: "Your payment of 5,000 XAF has been confirmed for Douala to Yaoundé. Verification code: ABC123"
Icon: CheckCircle2 (Lucide)
Sound: payment-success.wav
Data: {
  bookingId,
  paymentId,
  rideId,
  icon: "CheckCircle2",
  verificationCode: "ABC123",
  amount: 5000,
  fromCity: "Douala",
  toCity: "Yaoundé",
  departureTime: "2025-01-10T08:00:00Z"
}
```

### **Driver: Payment Received** ⭐
```
Title: "Payment Received"
Message: "Jean Dupont paid 5,000 XAF for Douala to Yaoundé. 2 seats. Code: ABC123"
Icon: Wallet (Lucide)
Sound: payment-success.wav
Data: {
  bookingId,
  paymentId,
  rideId,
  type: "payment_completed_driver",
  icon: "Wallet",
  // Passenger Details
  passengerId: "...",
  passengerName: "Jean Dupont",
  passengerPhone: "+237670000000",
  passengerAvatar: "https://...",
  // Booking Details
  seats: 2,
  verificationCode: "ABC123",
  // Payment Details
  amount: 5000,
  provider: "mtn",
  transactionId: "MTN-123456",
  // Ride Details
  fromCity: "Douala",
  toCity: "Yaoundé",
  departureTime: "2025-01-10T08:00:00Z"
}
```

### **Payment Failed**
```
Title: "Payment Failed"
Message: "Payment could not be processed. Insufficient balance. Please try again."
Icon: XCircle (Lucide)
Sound: payment-failed.wav
Data: { icon: "XCircle", ... }
```

### **Payment Pending**
```
Title: "Payment Pending"
Message: "Please complete payment of 5,000 XAF on your MTN phone."
Icon: Clock (Lucide)
Sound: notification.wav
Data: { icon: "Clock", ... }
```

---

## 🎫 Booking Notifications

### **Booking Created**
```
Title: "Booking Created"
Message: "Your booking for Douala to Yaoundé is pending payment."
Icon: Ticket (Lucide)
Sound: (no sound - silent notification)
Data: { icon: "Ticket", ... }
```

### **Booking Confirmed**
```
Title: "Booking Confirmed"
Message: "Your trip from Douala to Yaoundé is confirmed. Have a safe journey!"
Icon: TicketCheck (Lucide)
Sound: booking-confirmed.wav
Data: { icon: "TicketCheck", ... }
```

### **Booking Cancelled**
```
Title: "Booking Cancelled"
Message: "Your booking for Douala to Yaoundé has been cancelled."
Icon: TicketX (Lucide)
Sound: booking-cancelled.wav
Data: { icon: "TicketX", ... }
```

---

## 💬 Message Notifications

### **New Message**
```
Title: "New message from Jean Dupont"
Message: "Bonjour! Je serai à l'heure demain."
Icon: MessageSquare (Lucide)
Sound: new-message.wav
Data: {
  conversationId,
  senderId,
  type: "new_message",
  icon: "MessageSquare"
}
```

---

## 🔊 Sound Mapping

Configured in Edge Function (`send-notification/index.ts`):

```typescript
const soundMap = {
  'payment_success': 'payment-success.wav',
  'payment_failed': 'payment-failed.wav',
  'payment_pending': 'notification.wav',
  'payment_processing': 'notification.wav',
  'booking_confirmed': 'booking-confirmed.wav',
  'booking_cancelled': 'booking-cancelled.wav',
  'new_message': 'new-message.wav',
  'general': 'announcement.wav',
};
```

All sound files should be in `public/sounds/` (already exists).

---

## ✅ Data Validation Rules

### **Never Hardcode:**
- ❌ City names → Use `ride.from_city` and `ride.to_city`
- ❌ Passenger names → Use `passenger.full_name` or `passenger.phone`
- ❌ Amounts → Use `payment.amount` with proper formatting
- ❌ Seat counts → Use `booking.seats`
- ❌ Verification codes → Use `booking.verification_code`

### **Always:**
- ✅ Fetch fresh data from database
- ✅ Format amounts: `new Intl.NumberFormat('fr-FR').format(amount)`
- ✅ Handle plurals: `${seats} seat${seats > 1 ? 's' : ''}`
- ✅ Provide fallbacks: `passenger?.full_name || passenger?.phone || 'Passenger'`

---

## 🌍 Internationalization

Currently English templates. To add French:

```typescript
const locale = user.preferredLanguage || 'en';

const messages = {
  en: {
    title: 'Payment Confirmed',
    message: `Your payment of ${amount} XAF has been confirmed...`
  },
  fr: {
    title: 'Paiement Confirmé',
    message: `Votre paiement de ${amount} XAF a été confirmé...`
  }
};

const { title, message } = messages[locale];
```

---

## 📊 Template Usage Statistics

Monitor which templates are most used:

```sql
SELECT 
  notification_type,
  COUNT(*) as sent_count,
  AVG(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) * 100 as success_rate
FROM payment_notification_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY notification_type
ORDER BY sent_count DESC;
```

---

## 🎨 Design Guidelines

1. **Icons**: Lucide React icons (from shadcn/ui) - passed as names in `data.icon`
2. **Colors**: Icons inherit theme colors on frontend
3. **Titles**: Max 30 characters for mobile
4. **Messages**: Max 120 characters for optimal display
5. **No emojis**: Use Lucide icons instead for professional look
6. **Data**: Always use real values, never hardcode

### Icon Rendering Example

```typescript
// In your notification component
import * as Icons from 'lucide-react';

function NotificationIcon({ iconName }: { iconName: string }) {
  const Icon = Icons[iconName as keyof typeof Icons];
  return Icon ? <Icon className="h-6 w-6" /> : null;
}

// Usage
<NotificationIcon iconName={notification.data.icon} />
// Renders: <CheckCircle2 /> or <Wallet /> etc.
```

---

**Clean, professional, data-driven notifications** 🎯

