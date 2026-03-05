import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerBookingPolicyService } from "../bookings/booking-policy-service";

/** Thrown by API-oriented methods; route handlers map statusCode to HTTP status */
export class RideApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "RideApiError";
  }
}

export const MAX_RIDE_PRICE_FCFA = 6000;

export interface GetRidesParams {
  driver_id?: string;
  from_city?: string;
  to_city?: string;
  min_price?: number;
  max_price?: number;
  min_seats?: number;
  upcoming?: boolean;
  page?: number;
  limit?: number;
}

export interface DriverRidesParams {
  upcoming?: boolean;
  past?: boolean;
}

export interface RideOperationContext {
  supabase: SupabaseClient;
}

export interface RideReadOperationContext extends RideOperationContext {
  bookingPolicyService: ServerBookingPolicyService;
}

