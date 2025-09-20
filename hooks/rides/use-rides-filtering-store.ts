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

    // Sort rides
    filtered.sort((a, b) => {
      const timeA = new Date(a.departure_time).getTime();
      const timeB = new Date(b.departure_time).getTime();
      
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
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
