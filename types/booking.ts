import type { Ride, RideWithDriver } from './ride';
import type { UserProfile } from './user';

export interface Booking {
  readonly id: string;
  readonly ride_id: string;
  readonly user_id: string;
  readonly seats: number;
  readonly status: BookingStatus;
  readonly payment_status: PaymentStatus;
  readonly code_verified?: boolean;
  readonly selected_pickup_point_id?: string;
  readonly pickup_point_name?: string;
  readonly pickup_time?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'expired'
  | 'pending_verification';

export type PaymentStatus = 
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partial';

export interface BookingWithDetails extends Booking {
  readonly ride: RideWithDriver;
  readonly user: UserProfile;
}

export interface BookingWithPayments extends BookingWithDetails {
  readonly payments?: Array<{
    readonly id: string;
    readonly amount: number;
    readonly currency: string;
    readonly phone_number: string;
    readonly payment_time?: string;
    readonly metadata?: {
      readonly financialTransactionId?: string;
      readonly [key: string]: any;
    };
    readonly status?: string;
    readonly [key: string]: any;
  }>;
  readonly receipt?: {
    readonly id: string;
    readonly payment_id: string;
    readonly created_at: string;
  };
}

export interface CreateBookingRequest {
  readonly ride_id: string;
  readonly seats: number;
  readonly selected_pickup_point_id?: string;
}

export interface UpdateBookingRequest {
  readonly status?: BookingStatus;
  readonly payment_status?: PaymentStatus;
  readonly code_verified?: boolean;
  readonly seats?: number;
}

// Dashboard-specific booking type with embedded user data
export interface DashboardBooking {
  readonly id: string;
  readonly ride_id: string;
  readonly seats: number;
  readonly status: string; // More flexible than BookingStatus
  readonly payment_status?: string; // More flexible than PaymentStatus
  readonly code_verified?: boolean;
  readonly transaction_id?: string;
  readonly payment_provider?: string;
  readonly created_at?: string;
  readonly selected_pickup_point_id?: string;
  readonly pickup_point_name?: string;
  readonly pickup_time?: string;
  readonly user: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
  };
}

// Driver bookings page specific interface with embedded user and ride data
export interface DriverBooking {
  readonly id: string;
  readonly ride_id: string;
  readonly seats: number;
  readonly status: string;
  readonly created_at: string;
  readonly payment_status: string;
  readonly code_verified?: boolean;
  readonly selected_pickup_point_id?: string;
  readonly pickup_point_name?: string;
  readonly pickup_time?: string;
  readonly user_id: string;
  readonly user: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
    readonly phone?: string;
  };
  readonly ride: {
    readonly id: string;
    readonly from_city: string;
    readonly to_city: string;
    readonly departure_time: string;
    readonly price: number;
  };
}

// Ride with bookings for driver bookings page
export interface RideWithDriverBookings {
  readonly id: string;
  readonly from_city: string;
  readonly to_city: string;
  readonly departure_time: string;
  readonly price: number;
  readonly bookings: DriverBooking[];
}
