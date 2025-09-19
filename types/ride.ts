import type { Booking } from './booking';
import { Passenger } from './passenger';

export interface Ride {
  readonly id: string;
  readonly driver_id: string;
  readonly from_city: string;
  readonly to_city: string;
  readonly departure_time: string;
  readonly price: number;
  readonly seats_available: number;
  readonly description?: string;
  readonly car_model?: string;
  readonly car_color?: string;
  readonly created_at: string;
  readonly updated_at: string;
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
