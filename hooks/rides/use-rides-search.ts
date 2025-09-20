import { useState, useCallback, useEffect } from "react";
import { useRidesStore } from "@/stores";
import type { Ride } from "@/types";

interface RideSearchFilters {
  fromCity?: string | null;
  toCity?: string | null;
  minPrice?: number;
  maxPrice?: number;
  minSeats?: number;
}

interface UseRidesSearchReturn {
  rides: Ride[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  searchFilters: RideSearchFilters;
  setSearchFilters: (filters: RideSearchFilters) => void;
  loadRides: (filters?: RideSearchFilters) => Promise<void>;
  refreshRides: () => Promise<void>;
}

/**
 * Hook for searching and filtering rides using the centralized rides store
 * This replaces the direct Supabase calls in the rides page
 */
export function useRidesSearch(itemsPerPage: number = 10): UseRidesSearchReturn {
  const {
    allRides,
    allRidesLoading,
    allRidesError,
    allRidesPagination,
    fetchAllRides,
    searchRides,
  } = useRidesStore();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchFilters, setSearchFilters] = useState<RideSearchFilters>({});

  // Load rides with current filters and pagination
  const loadRides = useCallback(
    async (filters?: RideSearchFilters) => {
      const activeFilters = filters || searchFilters;
      
      await searchRides({
        from_city: activeFilters.fromCity || undefined,
        to_city: activeFilters.toCity || undefined,
        min_price: activeFilters.minPrice || undefined,
        max_price: activeFilters.maxPrice || undefined,
        min_seats: activeFilters.minSeats || undefined,
        page: currentPage,
        limit: itemsPerPage,
      });
    },
    [searchFilters, currentPage, itemsPerPage, searchRides]
  );

  // Refresh rides with current filters
  const refreshRides = useCallback(async () => {
    await loadRides();
  }, [loadRides]);

  // Update filters and reload
  const updateFilters = useCallback(
    (newFilters: RideSearchFilters) => {
      setSearchFilters(newFilters);
      setCurrentPage(1); // Reset to first page when filters change
    },
    []
  );

  // Load rides when filters or page changes
  useEffect(() => {
    loadRides();
  }, [loadRides]);

  // Get total pages from pagination
  const totalPages = allRidesPagination?.total_pages || 1;

  return {
    rides: allRides,
    loading: allRidesLoading,
    error: allRidesError,
    totalPages,
    currentPage,
    setCurrentPage,
    searchFilters,
    setSearchFilters: updateFilters,
    loadRides,
    refreshRides,
  };
}
