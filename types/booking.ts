export interface Booking {
  readonly id: string;
  readonly ride_id: string;
  readonly user_id: string;
  readonly seats: number;
  readonly status: BookingStatus;
  readonly payment_status: PaymentStatus;
  readonly code_verified?: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'expired';

export type PaymentStatus = 
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partial';

export interface BookingWithDetails extends Booking {
  readonly ride: Ride;
  readonly user: UserProfile;
}

export interface CreateBookingRequest {
  readonly ride_id: string;
  readonly seats: number;
}

export interface UpdateBookingRequest {
  readonly status?: BookingStatus;
  readonly payment_status?: PaymentStatus;
  readonly code_verified?: boolean;
}
