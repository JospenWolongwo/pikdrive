import type { Booking, DashboardBooking } from './booking';
import { Passenger } from './passenger';
import type { RideMessage } from './chat';

// Base Ride interface - core ride data
export interface Ride {
  readonly id: string;
  readonly driver_id: string;
  readonly from_city: string;
  readonly to_city: string;
  readonly departure_time: string;
  readonly price: number;
  readonly seats_available: number;
  readonly estimated_duration?: string;
  readonly description?: string;
  readonly car_model?: string;
  readonly car_color?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

// Extended Ride interface with driver details and vehicle images
export interface RideWithDriver extends Ride {
  readonly driver?: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
    readonly image?: string;
    readonly rating?: number;
    readonly trips?: number;
    readonly vehicle_images?: string[];
  };
  readonly bookings?: { readonly id: string; readonly seats: number }[];
}

// Extended Ride interface for dashboard with bookings and messages
export interface RideWithDetails extends Ride {
  readonly bookings: DashboardBooking[];
  readonly messages: RideMessage[];
}

export interface RideWithPassengers {
  readonly id: string;
  readonly from_city: string;
  readonly to_city: string;
  readonly departure_time: string;
  readonly departure_date: string;
  readonly price_per_seat: number;
  readonly total_seats: number;
  readonly available_seats: number;
  readonly created_at: string;
  readonly passengers: Passenger[];
}

export interface RideWithBookings extends Ride {
  readonly bookings?: Booking[];
}

export interface CreateRideRequest {
  readonly from_city: string;
  readonly to_city: string;
  readonly departure_time: string;
  readonly price: number;
  readonly seats_available: number;
  readonly description?: string;
  readonly car_model?: string;
  readonly car_color?: string;
}

export interface UpdateRideRequest {
  readonly from_city?: string;
  readonly to_city?: string;
  readonly departure_time?: string;
  readonly price?: number;
  readonly seats_available?: number;
  readonly description?: string;
  readonly car_model?: string;
  readonly car_color?: string;
}

// Additional ride-related types
export interface UnreadCount {
  readonly rideId: string;
  readonly count: number;
}

export interface UnreadCounts {
  readonly [key: string]: number;
}

export interface CancelledBooking {
  readonly id: string;
  readonly passengerName: string;
  readonly rideRoute: string;
  readonly seats: number;
  readonly cancelledAt: string;
}
