import { useState, useEffect, useCallback, useMemo } from "react";
import { useDriverStore } from "@/stores";
import type { RideWithPassengers, RideWithDriverBookings } from "@/types";

interface UseDriverBookingsReturn {
  bookings: RideWithDriverBookings[];
  loading: boolean;
  error: string | null;
  refreshBookings: () => Promise<void>;
  loadBookings: () => Promise<void>;
}

/**
 * Hook for driver bookings using the centralized driver store
 * This replaces the direct Supabase calls in the driver bookings page
 */
export function useDriverBookings(): UseDriverBookingsReturn {
  const {
    reservations,
    reservationsLoading,
    reservationsError,
    fetchReservations,
    refreshReservations,
  } = useDriverStore();

  // Transform reservations data to match the expected format
  const bookings = useMemo(() => {
    return reservations.map(ride => ({
      id: ride.id,
      from_city: ride.from_city,
      to_city: ride.to_city,
      departure_time: ride.departure_time,
      price: ride.price_per_seat,
      bookings: ride.passengers.map(passenger => ({
        id: passenger.booking_id,
        ride_id: ride.id,
        user_id: passenger.user_id,
        seats: passenger.seats,
        status: passenger.status,
        payment_status: passenger.payment_status,
        code_verified: passenger.code_verified,
        created_at: passenger.booking_created_at,
        user: {
          id: passenger.user_id,
          full_name: passenger.full_name,
          avatar_url: passenger.avatar_url,
          phone: passenger.phone,
        },
        ride: {
          id: ride.id,
          from_city: ride.from_city,
          to_city: ride.to_city,
          departure_time: ride.departure_time,
          price: ride.price_per_seat,
        },
      })),
    }));
  }, [reservations]);

  // Load bookings (same as fetchReservations)
  const loadBookings = useCallback(async () => {
    await fetchReservations();
  }, [fetchReservations]);

  // Refresh bookings (same as refreshReservations)
  const refreshBookings = useCallback(async () => {
    await refreshReservations();
  }, [refreshReservations]);

  return {
    bookings,
    loading: reservationsLoading,
    error: reservationsError,
    refreshBookings,
    loadBookings,
  };
}
