export interface ApiResponse<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly total_pages: number;
  };
}

export interface ApiError {
  readonly error: string;
  readonly details?: string;
  readonly code?: string;
}

export interface DatabaseBooking {
  readonly id: string;
  readonly ride_id: string;
  readonly user_id: string;
  readonly seats: number;
  readonly status: string;
  readonly payment_status: string | null;
  readonly code_verified?: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly ride: any; // Will be properly typed based on usage
}

export interface DatabaseRide {
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

export interface DatabaseProfile {
  readonly id: string;
  readonly full_name: string;
  readonly avatar_url?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly created_at: string;
  readonly updated_at: string;
}
