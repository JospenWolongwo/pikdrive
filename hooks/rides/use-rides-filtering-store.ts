import { useMemo } from "react";
import type { RideWithDetails } from "@/types";

interface UseRidesFilteringProps {
  rides: RideWithDetails[];
  nowUTC: Date;
  searchQuery: string;
  sortOrder: "asc" | "desc";
}

/**
 * Hook for filtering and sorting rides using the centralized store data
 * This replaces the direct filtering in use-rides-filtering.ts
 */
export function useRidesFilteringStore({
  rides,
  nowUTC,
  searchQuery,
  sortOrder,
}: UseRidesFilteringProps) {
  const filteredAndSortedRides = useMemo(() => {
    let filtered = rides;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = rides.filter((ride) => {
        const route = `${ride.from_city} → ${ride.to_city}`.toLowerCase();
        const description = ride.description?.toLowerCase() || "";
        const carModel = ride.car_model?.toLowerCase() || "";
        
        return (
          route.includes(query) ||
          description.includes(query) ||
          carModel.includes(query)
        );
      });
    }

    // Sort rides by most recent booking's created_at timestamp (newest first)
    filtered.sort((a, b) => {
      // Get the most recent booking for each ride
      const getMostRecentBookingTime = (ride: RideWithDetails): number => {
        if (!ride.bookings || ride.bookings.length === 0) {
          return Number.MIN_SAFE_INTEGER; // Rides with no bookings go to the end
        }
        
        // Find the most recent booking by created_at
        const bookingTimes = ride.bookings
          .map(booking => {
            const created_at = (booking as any).created_at;
            if (!created_at) return Number.MIN_SAFE_INTEGER;
            const time = new Date(created_at).getTime();
            return isNaN(time) ? Number.MIN_SAFE_INTEGER : time;
          })
          .filter(time => time !== Number.MIN_SAFE_INTEGER);
        
        if (bookingTimes.length === 0) {
          return Number.MIN_SAFE_INTEGER;
        }
        
        // Return the most recent (highest) timestamp
        return Math.max(...bookingTimes);
      };
      
      const timeA = getMostRecentBookingTime(a);
      const timeB = getMostRecentBookingTime(b);
      
      // Always sort descending (newest booking first), regardless of sortOrder
      // The sortOrder is for departure_time, but we want booking recency
      return timeB - timeA;
    });

    return filtered;
  }, [rides, searchQuery, sortOrder]);

  const upcomingRides = useMemo(() => {
    return filteredAndSortedRides.filter((ride) => {
      const departureTime = new Date(ride.departure_time);
      return departureTime > nowUTC;
    });
  }, [filteredAndSortedRides, nowUTC]);

  const pastRides = useMemo(() => {
    return filteredAndSortedRides.filter((ride) => {
      const departureTime = new Date(ride.departure_time);
      return departureTime <= nowUTC;
    });
  }, [filteredAndSortedRides, nowUTC]);

  return {
    filteredAndSortedRides,
    upcomingRides,
    pastRides,
  };
}
