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
  | 'driver_arriving'
  | 'driver_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
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
  driver_arriving: '/sounds/new-message.wav', // Reuse for now
  driver_arrived: '/sounds/booking-confirmed.wav', // Reuse for now
  ride_started: '/sounds/booking-confirmed.wav', // Reuse for now
  ride_completed: '/sounds/payment-success.wav', // Reuse for now
  ride_cancelled: '/sounds/booking-cancelled.wav', // Reuse for now
  announcement: '/sounds/announcement.wav',
};

// Action routes for notification clicks
export const NOTIFICATION_ACTIONS: Record<NotificationType, (data: NotificationData) => string> = {
  booking_confirmed: (data) => `/bookings/${data.bookingId}`,
  booking_cancelled: (data) => `/bookings/${data.bookingId}`,
  booking_updated: (data) => `/bookings/${data.bookingId}`,
  payment_pending: (data) => `/payments/${data.paymentId}`,
  payment_processing: (data) => `/payments/${data.paymentId}`,
  payment_success: (data) => `/receipts/${data.paymentId}`,
  payment_failed: (data) => `/payments/retry/${data.paymentId}`,
  new_message: (data) => `/messages/${data.conversationId}`,
  driver_arriving: (data) => `/bookings/${data.bookingId}`,
  driver_arrived: (data) => `/bookings/${data.bookingId}`,
  ride_started: (data) => `/bookings/${data.bookingId}`,
  ride_completed: (data) => `/bookings/${data.bookingId}`,
  ride_cancelled: (data) => `/bookings/${data.bookingId}`,
  announcement: () => '/announcements',
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
