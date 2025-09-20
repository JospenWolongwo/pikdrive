export interface Passenger {
  readonly booking_id: string;
  readonly user_id: string;
  readonly seats: number;
  readonly status: string;
  readonly payment_status: string;
  readonly code_verified?: boolean;
  readonly booking_created_at: string;
  readonly full_name: string;
  readonly avatar_url?: string;
  readonly phone?: string;
  readonly _profileError?: boolean; // Flag to indicate profile fetch failed
}

export interface PassengerWithRide extends Passenger {
  readonly ride: {
    readonly id: string;
    readonly from_city: string;
    readonly to_city: string;
    readonly departure_time: string;
    readonly price: number;
  };
}
