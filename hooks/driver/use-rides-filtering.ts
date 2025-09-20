import { useMemo } from "react";
import type { RideWithDetails } from "@/types";

export function useRidesFiltering(
  rides: RideWithDetails[],
  nowUTC: Date,
  searchQuery: string,
  sortOrder: "asc" | "desc"
) {
  // Calculate upcoming and past rides with search filtering
  const upcomingRides = useMemo(() => {
    // First filter by departure time
    const upcoming = rides.filter(
      (ride) => new Date(ride.departure_time).getTime() > nowUTC.getTime()
    );

    // Then apply search filter
    const filtered = upcoming.filter((ride) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase().trim();
      return (
        ride.from_city.toLowerCase().includes(query) ||
        ride.to_city.toLowerCase().includes(query) ||
        ride.car_model?.toLowerCase().includes(query) ||
        // Search in bookings
        ride.bookings?.some(
          (booking) =>
            booking.user?.full_name.toLowerCase().includes(query) ||
            booking.status.toLowerCase().includes(query)
        )
      );
    });

    // Finally sort based on departure time (asc or desc)
    return filtered.sort((a, b) => {
      const timeA = new Date(a.departure_time).getTime();
      const timeB = new Date(b.departure_time).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
  }, [rides, nowUTC, searchQuery, sortOrder]);

  const pastRides = useMemo(() => {
    // First filter by departure time
    const past = rides.filter(
      (ride) => new Date(ride.departure_time).getTime() <= nowUTC.getTime()
    );

    // Then apply search filter
    const filtered = past.filter((ride) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase().trim();
      return (
        ride.from_city.toLowerCase().includes(query) ||
        ride.to_city.toLowerCase().includes(query) ||
        ride.car_model?.toLowerCase().includes(query) ||
        // Search in bookings
        ride.bookings?.some(
          (booking) =>
            booking.user?.full_name.toLowerCase().includes(query) ||
            booking.status.toLowerCase().includes(query)
        )
      );
    });

    // Sort by departure time - past rides are default most recent first
    return filtered.sort((a, b) => {
      const timeA = new Date(a.departure_time).getTime();
      const timeB = new Date(b.departure_time).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
  }, [rides, nowUTC, searchQuery, sortOrder]);

  return {
    upcomingRides,
    pastRides,
  };
}
