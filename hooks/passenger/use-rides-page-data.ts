import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRidesStore, useBookingStore } from "@/stores";
import { useChatStore } from "@/stores/chatStore";
import { useToast } from "@/hooks/ui";
import { mapUnreadCountsByRideId } from "@/lib/utils/unread-counts";
import { useRouter } from "next/navigation";
import type { RideFilters } from "./use-ride-filters";
import type { UnreadCounts } from "@/lib/utils/unread-counts";

interface UseRidesPageDataReturn {
  loading: boolean;
  rides: any[];
  pagination: {
    page: number;
    totalPages: number;
  };
  unreadCounts: UnreadCounts;
  loadRides: (filters?: Partial<RideFilters>, page?: number) => Promise<void>;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
}

const ITEMS_PER_PAGE = 10;

export function useRidesPageData(): UseRidesPageDataReturn {
  const { supabase, user } = useSupabase();
  const router = useRouter();
  const { toast } = useToast();
  const {
    allRides,
    allRidesLoading,
    allRidesPagination,
    searchRides,
    fetchAllRides,
    lastAllRidesFetch,
    subscribeToRideUpdates,
    unsubscribeFromRideUpdates,
  } = useRidesStore();
  const { fetchUserBookings } = useBookingStore();
  const { unreadCounts: unreadCountsArray, conversations, subscribeToRide } =
    useChatStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Map unread counts by rideId
  const unreadCounts = mapUnreadCountsByRideId(unreadCountsArray, conversations);

  const loadRides = useCallback(
    async (newFilters?: Partial<RideFilters>, page?: number) => {
      try {
        const pageToUse = page ?? currentPage;
        
        // Merge partial filters with defaults
        const defaultFilters: RideFilters = {
          fromCity: null,
          toCity: null,
          minPrice: 0,
          maxPrice: 20000,
          minSeats: 1,
        };
        
        const activeFilters: RideFilters = newFilters
          ? {
              fromCity: newFilters.fromCity ?? defaultFilters.fromCity,
              toCity: newFilters.toCity ?? defaultFilters.toCity,
              minPrice: newFilters.minPrice ?? defaultFilters.minPrice,
              maxPrice: newFilters.maxPrice ?? defaultFilters.maxPrice,
              minSeats: newFilters.minSeats ?? defaultFilters.minSeats,
            }
          : defaultFilters;

        const hasFilters = Boolean(
          (activeFilters.fromCity && activeFilters.fromCity !== "any") ||
            (activeFilters.toCity && activeFilters.toCity !== "any") ||
            activeFilters.minPrice !== 0 ||
            activeFilters.maxPrice !== 20000 ||
            activeFilters.minSeats !== 1
        );

        if (hasFilters) {
          await searchRides({
            from_city:
              activeFilters.fromCity && activeFilters.fromCity !== "any"
                ? activeFilters.fromCity
                : undefined,
            to_city:
              activeFilters.toCity && activeFilters.toCity !== "any"
                ? activeFilters.toCity
                : undefined,
            min_price: activeFilters.minPrice,
            max_price: activeFilters.maxPrice,
            min_seats: activeFilters.minSeats,
            page: pageToUse,
            limit: ITEMS_PER_PAGE,
          });
        } else {
          await fetchAllRides({
            page: pageToUse,
            limit: ITEMS_PER_PAGE,
            upcoming: true,
          });
        }

        // Update pagination from store response
        if (allRidesPagination) {
          setTotalPages(allRidesPagination.total_pages);
        }
      } catch (error) {
        console.error("Error loading rides:", error);
        toast({
          variant: "destructive",
          title: "Error loading rides",
          description: "Please try again later.",
        });
      }
    },
    [currentPage, searchRides, fetchAllRides, allRidesPagination, toast]
  );

  // Load rides on component mount
  useEffect(() => {
    const fresh =
      lastAllRidesFetch && Date.now() - lastAllRidesFetch < 5 * 60 * 1000;
    if (!fresh || allRides.length === 0) {
      loadRides(undefined, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Subscribe to real-time ride updates for seat availability
  useEffect(() => {
    if (supabase && allRides.length > 0) {
      subscribeToRideUpdates(supabase);

      return () => {
        unsubscribeFromRideUpdates();
      };
    }
  }, [
    supabase,
    allRides.length,
    subscribeToRideUpdates,
    unsubscribeFromRideUpdates,
  ]);

  // Reload rides when page changes
  useEffect(() => {
    loadRides(undefined, currentPage);
  }, [currentPage, loadRides]);

  // Subscribe to each ride for chat updates
  useEffect(() => {
    allRides.forEach((ride) => {
      subscribeToRide(ride.id);
    });
  }, [allRides, subscribeToRide]);

  // Preload user bookings for instant modal performance
  useEffect(() => {
    if (user?.id && fetchUserBookings) {
      fetchUserBookings(user.id);
    }
  }, [user?.id]);

  // Note: Booking notifications are handled by OneSignal via server-side triggers

  return {
    loading: allRidesLoading,
    rides: allRides,
    pagination: {
      page: currentPage,
      totalPages,
    },
    unreadCounts,
    loadRides,
    currentPage,
    setCurrentPage,
    itemsPerPage: ITEMS_PER_PAGE,
  };
}

