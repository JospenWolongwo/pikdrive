import type { RidePickupPointInput } from "@/types";

export type RideFormValues = {
  from_city: string;
  to_city: string;
  dropoff_point_id?: string;
  departure_date: string;
  departure_time: string;
  price: string;
  seats: string;
  description?: string;
  pickup_points?: RidePickupPointInput[];
};

export interface RideBooking {
  id: string;
  status: string;
  user_id: string;
  seats?: number;
  payment_status?: string;
  selected_pickup_point_id?: string | null;
  no_show_marked_at?: string | null;
  user?: {
    full_name?: string;
  };
  policy?: {
    canDriverMarkNoShow?: boolean;
  };
}

export interface RideDetails {
  id: string;
  from_city: string;
  to_city: string;
  dropoff_point_id?: string | null;
  dropoff_point_name?: string | null;
  departure_time: string;
  price: number;
  seats_available: number;
  description?: string;
  car_model?: string;
  car_color?: string;
  driver_id: string;
  pickup_points?: {
    id: string;
    name?: string;
    order: number;
    time_offset_minutes: number;
  }[];
  bookings?: RideBooking[];
}

export type TranslateFn = (
  key: string,
  params?: Record<string, string>
) => string;
