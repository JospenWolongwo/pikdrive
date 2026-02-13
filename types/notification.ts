// Professional notification types for PikDrive
// Inspired by Uber, DoorDash, and MTN MoMo best practices

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_updated'
  | 'payment_pending'
  | 'payment_processing'
  | 'payment_success'
  | 'payment_failed'
  | 'new_message'
  | 'driver_new_booking'
  | 'driver_booking_cancelled'
  | 'booking_confirmation_sms'
  | 'payment_failure_sms'
  | 'cancellation_confirmation_sms'
  | 'driver_arriving'
  | 'driver_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'ride_reminder'
  | 'pickup_point_update'
  | 'review_request_passenger'
  | 'review_request_driver'
  | 'review_received'
  | 'announcement';

export interface NotificationData {
  readonly bookingId?: string;
  readonly paymentId?: string;
  readonly conversationId?: string;
  readonly rideId?: string;
  readonly driverId?: string;
  readonly amount?: number;
  readonly transactionId?: string;
  readonly provider?: 'mtn' | 'orange';
  readonly [key: string]: any;
}

export interface NotificationPayload {
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly data?: NotificationData;
  readonly sound?: string;
  readonly action?: string;
  readonly imageUrl?: string;
}

export interface OneSignalNotificationEvent {
  readonly notificationId: string;
  readonly type: NotificationType;
  readonly data: NotificationData;
}

export interface NotificationPermissionState {
  readonly permission: NotificationPermission;
  readonly isSubscribed: boolean;
  readonly userId?: string;
}

// Sound file mapping (WAV format - higher quality!)
export const NOTIFICATION_SOUNDS: Record<NotificationType, string> = {
  booking_confirmed: '/sounds/booking-confirmed.wav',
  booking_cancelled: '/sounds/booking-cancelled.wav',
  booking_updated: '/sounds/booking-confirmed.wav', // Reuse for now
  payment_pending: '/sounds/new-message.wav', // Reuse for now
  payment_processing: '/sounds/new-message.wav', // Reuse for now
  payment_success: '/sounds/payment-success.wav',
  payment_failed: '/sounds/payment-failed.wav',
  new_message: '/sounds/new-message.wav',
  driver_new_booking: '/sounds/booking-confirmed.wav',
  driver_booking_cancelled: '/sounds/booking-cancelled.wav',
  booking_confirmation_sms: '/sounds/booking-confirmed.wav', // For push fallback
  payment_failure_sms: '/sounds/payment-failed.wav', // For push fallback
  cancellation_confirmation_sms: '/sounds/booking-cancelled.wav', // For push fallback
  driver_arriving: '/sounds/new-message.wav', // Reuse for now
  driver_arrived: '/sounds/booking-confirmed.wav', // Reuse for now
  ride_started: '/sounds/booking-confirmed.wav', // Reuse for now
  ride_completed: '/sounds/payment-success.wav', // Reuse for now
  ride_cancelled: '/sounds/booking-cancelled.wav', // Reuse for now
  ride_reminder: '/sounds/new-message.wav', // Reuse for now
  pickup_point_update: '/sounds/new-message.wav', // Reuse for now
  review_request_passenger: '/sounds/new-message.wav',
  review_request_driver: '/sounds/new-message.wav',
  review_received: '/sounds/payment-success.wav',
  announcement: '/sounds/announcement.wav',
};

// Action routes for notification clicks
export const NOTIFICATION_ACTIONS: Record<NotificationType, (data: NotificationData) => string> = {
  booking_confirmed: () => `/bookings`,
  booking_cancelled: () => `/bookings`,
  booking_updated: () => `/bookings`,
  payment_pending: (data) => data.paymentId ? `/payments/${data.paymentId}` : `/payments`,
  payment_processing: (data) => data.paymentId ? `/payments/${data.paymentId}` : `/payments`,
  payment_success: (data) => data.paymentId ? `/receipts/${data.paymentId}` : `/bookings`,
  payment_failed: (data) => data.paymentId ? `/payments/retry/${data.paymentId}` : `/payments`,
  new_message: (data) => {
    if (data.rideId && data.senderId) {
      return `/messages?ride=${data.rideId}&user=${data.senderId}`;
    }
    if (data.rideId) {
      return `/messages?ride=${data.rideId}`;
    }
    return `/messages`;
  },
  driver_new_booking: (data) => data.rideId ? `/driver/rides/${data.rideId}` : `/driver/dashboard`,
  driver_booking_cancelled: (data) => data.rideId ? `/driver/rides/${data.rideId}` : `/driver/dashboard`,
  booking_confirmation_sms: () => `/bookings`,
  payment_failure_sms: (data) => data.paymentId ? `/payments/retry/${data.paymentId}` : `/payments`,
  cancellation_confirmation_sms: () => `/bookings`,
  driver_arriving: () => `/bookings`,
  driver_arrived: () => `/bookings`,
  ride_started: () => `/bookings`,
  ride_completed: () => `/bookings`,
  ride_cancelled: () => `/bookings`,
  ride_reminder: () => `/bookings`,
  pickup_point_update: () => `/bookings`,
  review_request_passenger: (data) => data.bookingId ? `/reviews/submit?booking_id=${data.bookingId}` : `/bookings`,
  review_request_driver: (data) => data.bookingId ? `/reviews/submit?booking_id=${data.bookingId}` : `/bookings`,
  review_received: () => `/profile`,
  announcement: () => '/announcements',
};

/** Server may send these types; map to NOTIFICATION_ACTIONS key for path resolution. */
export const NOTIFICATION_TYPE_ALIASES: Record<string, NotificationType> = {
  payment_completed: 'payment_success',
  payment_completed_driver: 'driver_new_booking',
  driver_booking_paid: 'driver_new_booking',
};

// OneSignal Service Types
export interface NotificationRequest {
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly data?: Record<string, any>;
  readonly notificationType?: string;
  readonly imageUrl?: string;
  readonly phoneNumber?: string; // For SMS notifications
  readonly sendSMS?: boolean; // Flag to enable SMS
}

export interface NotificationResponse {
  readonly success: boolean;
  readonly notificationId?: string;
  readonly recipients?: number;
  readonly error?: string;
}

// Database notification logs (for analytics)
export interface NotificationLog {
  readonly id: string;
  readonly user_id: string;
  readonly title: string;
  readonly message: string;
  readonly notification_type: string;
  readonly onesignal_id?: string;
  readonly recipients: number;
  readonly data?: Record<string, any>;
  readonly status: 'sent' | 'delivered' | 'clicked' | 'failed';
  readonly delivered_at?: string;
  readonly clicked_at?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

// OneSignal webhook logs (for analytics)
export interface OneSignalWebhookLog {
  readonly id: string;
  readonly event_type: string;
  readonly notification_id?: string;
  readonly user_id?: string;
  readonly data?: Record<string, any>;
  readonly created_at: string;
}

// WhatsApp Business API Types
export interface WhatsAppTemplateRequest {
  readonly templateName: string;
  readonly phoneNumber: string;
  readonly variables: readonly string[];
  readonly language?: string; // Default: 'fr'
}

export interface WhatsAppMessageResponse {
  readonly success: boolean;
  readonly messageId?: string;
  readonly status?: 'sent' | 'delivered' | 'read' | 'failed';
  readonly error?: string;
  readonly errorCode?: number;
}

export interface MultiChannelNotificationRequest {
  readonly userId: string;
  readonly phoneNumber?: string;
  readonly whatsappEnabled?: boolean;
  readonly onesignalData: NotificationRequest;
  readonly whatsappData?: WhatsAppTemplateRequest;
}

export type NotificationChannel = 'onesignal' | 'whatsapp' | 'both';
