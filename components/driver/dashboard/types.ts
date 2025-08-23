export interface Ride {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  price: number;
  seats_available: number;
  car_model: string;
  car_color: string;
  created_at: string;
  bookings: Array<{
    id: string;
    ride_id: string;
    seats: number;
    status: string;
    payment_status?: string;
    code_verified?: boolean;
    transaction_id?: string;
    payment_provider?: string;
    user: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  }>;
  messages: Array<{
    id: string;
    ride_id: string;
    content: string;
    created_at: string;
    sender: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  }>;
}

export interface Booking {
  id: string;
  ride_id: string;
  seats: number;
  status: string;
  payment_status?: string;
  code_verified?: boolean;
  transaction_id?: string;
  payment_provider?: string;
  user: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface Message {
  id: string;
  ride_id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface UnreadCount {
  rideId: string;
  count: number;
}

export interface CancelledBooking {
  id: string;
  passengerName: string;
  rideRoute: string;
  seats: number;
  cancelledAt: string;
}

export interface PaymentCheckRequest {
  bookingId: string;
  transactionId: string;
  provider: string;
}
