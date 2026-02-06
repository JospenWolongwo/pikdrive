import { useEffect, useState, useCallback, useRef } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRidesStore, useBookingStore } from "@/stores";
import { useChatStore } from "@/stores/chatStore";
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

  // Map unread counts by rideId
  const unreadCounts = mapUnreadCountsByRideId(unreadCountsArray, conversations);

  const loadRides = useCallback(
    async (newFilters?: Partial<RideFilters>, page?: number) => {
      try {
        const pageToUse = page ?? currentPage;
        
        // Default filters
        const defaultFilters: RideFilters = {
          fromCity: null,
          toCity: null,
          minPrice: 0,
          maxPrice: 20000,
          minSeats: 1,
        };
        
        // Merge with defaults - if a field is explicitly null, keep it null
        const activeFilters: RideFilters = newFilters
          ? {
              fromCity: newFilters.fromCity ?? defaultFilters.fromCity,
              toCity: newFilters.toCity ?? defaultFilters.toCity,
              minPrice: newFilters.minPrice ?? defaultFilters.minPrice,
              maxPrice: newFilters.maxPrice ?? defaultFilters.maxPrice,
              minSeats: newFilters.minSeats ?? defaultFilters.minSeats,
            }
          : defaultFilters;

        // Check if any filters are active
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

  // Sync pagination total pages from store when it updates after fetch
  useEffect(() => {
    if (allRidesPagination?.total_pages != null) {
      setTotalPages(allRidesPagination.total_pages);
    }
  }, [allRidesPagination?.total_pages]);

  // Load rides on component mount (no reliance on persisted list; always load or use in-memory cache)
  useEffect(() => {
    const fresh =
      lastAllRidesFetch && Date.now() - lastAllRidesFetch < 5 * 60 * 1000;
    if (!fresh || allRides.length === 0) {
      loadRides(undefined, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when user returns to the tab (throttled to avoid hammering the API)
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefetchRef.current < FOCUS_REFETCH_THROTTLE_MS) return;
      lastFocusRefetchRef.current = now;
      loadRides(undefined, currentPage);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadRides, currentPage]);

  // Subscribe to new ride INSERTs: refetch only when store says we're viewing default list (page 1, no filters)
  useEffect(() => {
    if (!supabase) return;
    const unsubscribe = subscribeToNewRides(supabase, refetchFirstPageIfViewingDefault);
    return unsubscribe;
  }, [supabase, refetchFirstPageIfViewingDefault]);

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


  // Subscribe to each ride's conversation for chat updates
  useEffect(() => {
    allRides.forEach((ride) => {
      // Find the conversation for this ride
      const conversation = conversations.find(conv => conv.rideId === ride.id);
      if (conversation) {
        subscribeToRide(conversation.id);
      }
    });
  }, [allRides, conversations, subscribeToRide]);

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

