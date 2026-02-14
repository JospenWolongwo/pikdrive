import { useEffect, useState, useCallback, useRef } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRidesStore, useBookingStore } from "@/stores";
import { useChatStore } from "@/stores";
import { useToast } from "@/hooks/ui";
import { mapUnreadCountsByRideId } from "@/lib/utils/unread-counts";
import { subscribeToNewRides } from "@/lib/services/client/rides";
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
const FOCUS_REFETCH_THROTTLE_MS = 60 * 1000;

export function useRidesPageData(): UseRidesPageDataReturn {
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const lastFocusRefetchRef = useRef<number>(0);
  const {
    allRides,
    allRidesLoading,
    allRidesPagination,
    searchRides,
    refreshAllRides,
    lastAllRidesFetch,
    subscribeToRideUpdates,
    unsubscribeFromRideUpdates,
    refetchFirstPageIfViewingDefault,
  } = useRidesStore();
  const { fetchUserBookings } = useBookingStore();
  const { unreadCounts: unreadCountsArray, conversations, subscribeToRide } =
    useChatStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const unreadCounts = mapUnreadCountsByRideId(unreadCountsArray, conversations);

  const loadRides = useCallback(
    async (newFilters?: Partial<RideFilters>, page?: number) => {
      try {
        const pageToUse = page ?? currentPage;

        const defaultFilters: RideFilters = {
          fromCity: null,
          toCity: null,
          minPrice: 0,
          maxPrice: 20000,
          minSeats: 1,
        };

        // Explicit null in newFilters preserved for "any" selection
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
            from_city: activeFilters.fromCity && activeFilters.fromCity !== "any" ? activeFilters.fromCity : undefined,
            to_city: activeFilters.toCity && activeFilters.toCity !== "any" ? activeFilters.toCity : undefined,
            min_price: activeFilters.minPrice !== 0 ? activeFilters.minPrice : undefined,
            max_price: activeFilters.maxPrice !== 20000 ? activeFilters.maxPrice : undefined,
            min_seats: activeFilters.minSeats !== 1 ? activeFilters.minSeats : undefined,
            page: pageToUse,
            limit: ITEMS_PER_PAGE,
          });
        } else {
          await refreshAllRides({
            page: pageToUse,
            limit: ITEMS_PER_PAGE,
            upcoming: true,
          });
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
    [currentPage, searchRides, refreshAllRides, allRidesPagination, toast]
  );

  useEffect(() => {
    if (allRidesPagination?.total_pages != null) {
      setTotalPages(allRidesPagination.total_pages);
    }
  }, [allRidesPagination?.total_pages]);

  useEffect(() => {
    // Always load fresh or use 5min cache; no persisted list
    const fresh =
      lastAllRidesFetch && Date.now() - lastAllRidesFetch < 5 * 60 * 1000;
    if (!fresh || allRides.length === 0) {
      loadRides(undefined, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefetchRef.current < FOCUS_REFETCH_THROTTLE_MS) return; // Throttle refetch on tab focus
      lastFocusRefetchRef.current = now;
      loadRides(undefined, currentPage);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadRides, currentPage]);

  useEffect(() => {
    if (!supabase) return;
    const unsubscribe = subscribeToNewRides(supabase, refetchFirstPageIfViewingDefault); // Refetch only when viewing default list
    return unsubscribe;
  }, [supabase, refetchFirstPageIfViewingDefault]);

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

  useEffect(() => {
    allRides.forEach((ride) => {
      const conversation = conversations.find(conv => conv.rideId === ride.id);
      if (conversation) {
        subscribeToRide(conversation.id);
      }
    });
  }, [allRides, conversations, subscribeToRide]);

  useEffect(() => {
    if (user?.id && fetchUserBookings) {
      fetchUserBookings(user.id); // Preload for instant modal
    }
  }, [user?.id]);

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

