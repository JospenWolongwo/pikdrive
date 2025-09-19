export interface Notification {
  readonly id: string;
  readonly user_id: string;
  readonly title: string;
  readonly body: string;
  readonly type: NotificationType;
  readonly data?: Record<string, any>;
  readonly read: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export type NotificationType = 
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'ride_reminder'
  | 'payment_success'
  | 'payment_failed'
  | 'driver_assigned'
  | 'message_received'
  | 'system_alert';

export interface PushSubscription {
  readonly id: string;
  readonly user_id: string;
  readonly endpoint: string;
  readonly p256dh_key: string;
  readonly auth_key: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateNotificationRequest {
  readonly user_id: string;
  readonly title: string;
  readonly body: string;
  readonly type: NotificationType;
  readonly data?: Record<string, any>;
}

export interface SendNotificationRequest {
  readonly user_id: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, any>;
}
