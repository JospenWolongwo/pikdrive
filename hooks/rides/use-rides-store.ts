import { useCallback, useMemo } from "react";
import { useRidesStore } from "@/stores";
import type { RideWithDetails, CancelledBooking } from "@/types";

/**
 * Hook that provides rides data using the centralized rides store
 * This replaces the direct Supabase calls in use-rides-data.ts
 */
export function useRidesStoreData() {
  const {
    driverRides,
    driverRidesLoading,
    driverRidesError,
    fetchDriverRides,
    refreshDriverRides,
  } = useRidesStore();


  // Get current time in UTC - wrapped in useMemo to prevent dependency changes on every render
  const nowUTC = useMemo(() => {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      )
    );
  }, []); // Empty dependency array means this only runs once

  // Note: Upcoming and past rides separation is now handled by useRidesFilteringStore
  // This hook provides the raw data, filtering is done in the filtering hook

  // Load rides data
  const loadRides = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        await refreshDriverRides();
      } else {
        await fetchDriverRides();
      }
    },
    [fetchDriverRides, refreshDriverRides]
  );

  // Refresh rides data
  const refreshRides = useCallback(async () => {
    await refreshDriverRides();
  }, [refreshDriverRides]);

  // Get cancelled bookings for driver notifications
  const cancelledBookings: CancelledBooking[] = useMemo(() => {
    const cancelled: CancelledBooking[] = [];
    
    driverRides.forEach((ride) => {
      ride.bookings?.forEach((booking) => {
        if (booking.status === "cancelled") {
          cancelled.push({
            id: booking.id,
            passengerName: booking.user?.full_name || "Unknown",
            rideRoute: `${ride.from_city} → ${ride.to_city}`,
            seats: booking.seats,
            cancelledAt: (booking as any).updated_at || (booking as any).created_at,
          });
        }
      });
    });

    return cancelled.sort((a, b) => 
      new Date(b.cancelledAt).getTime() - new Date(a.cancelledAt).getTime()
    );
  }, [driverRides]);

  return {
    // Data
    ridesData: {
      rides: driverRides,
      lastUpdated: Date.now(), // This could be enhanced to track actual last fetch time
    },
    cancelledBookings,
    
    // Loading states
    loading: driverRidesLoading,
    error: driverRidesError,
    
    // Actions
    loadRides,
    refreshRides,
    
    // Utilities
    nowUTC,
  };
}
