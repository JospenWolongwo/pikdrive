import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { 
  Ride, 
  RideWithDetails, 
  RideWithDriver,
  CreateRideRequest, 
  UpdateRideRequest,
  PaginatedResponse 
} from "@/types";
import { ridesService } from "@/lib/services/rides-service";

interface RidesState {
  // All rides state (for search/browse)
  allRides: RideWithDriver[];
  allRidesLoading: boolean;
  allRidesError: string | null;
  allRidesPagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  } | null;

  // Driver rides state
  driverRides: RideWithDetails[];
  driverRidesLoading: boolean;
  driverRidesError: string | null;
  lastDriverRidesFetch: number | null;

  // Current ride details state
  currentRide: RideWithDetails | null;
  currentRideLoading: boolean;
  currentRideError: string | null;

  // Search filters state
  searchFilters: {
    from_city?: string;
    to_city?: string;
    min_price?: number;
    max_price?: number;
    min_seats?: number;
  };

  // Actions for all rides
  fetchAllRides: (params?: {
    driver_id?: string;
    from_city?: string;
    to_city?: string;
    min_price?: number;
    max_price?: number;
    min_seats?: number;
    upcoming?: boolean;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  setAllRidesLoading: (loading: boolean) => void;
  setAllRidesError: (error: string | null) => void;
  clearAllRides: () => void;

  // Actions for driver rides
  fetchDriverRides: (params?: {
    upcoming?: boolean;
    past?: boolean;
  }) => Promise<void>;
  refreshDriverRides: () => Promise<void>;
  setUpcomingDriverRides: () => Promise<void>;
  setPastDriverRides: () => Promise<void>;
  setDriverRidesLoading: (loading: boolean) => void;
  setDriverRidesError: (error: string | null) => void;
  clearDriverRides: () => void;

  // Actions for current ride
  fetchRideById: (rideId: string) => Promise<void>;
  setCurrentRide: (ride: RideWithDetails | null) => void;
  setCurrentRideLoading: (loading: boolean) => void;
  setCurrentRideError: (error: string | null) => void;
  clearCurrentRide: () => void;

  // CRUD actions
  createRide: (rideData: CreateRideRequest) => Promise<Ride>;
  updateRide: (rideId: string, updateData: UpdateRideRequest) => Promise<Ride>;
  deleteRide: (rideId: string) => Promise<void>;

  // User rides for messages/chat
  userRides: Ride[];
  userRidesLoading: boolean;
  userRidesError: string | null;
  fetchUserRides: (userId: string) => Promise<void>;

  // Search actions
  searchRides: (filters: {
    from_city?: string;
    to_city?: string;
    min_price?: number;
    max_price?: number;
    min_seats?: number;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  setSearchFilters: (filters: Partial<RidesState['searchFilters']>) => void;
  clearSearchFilters: () => void;
}

export const useRidesStore = create<RidesState>()(
  persist(
    (set, get) => ({
    // Initial state
    allRides: [],
    allRidesLoading: false,
    allRidesError: null,
    allRidesPagination: null,

    driverRides: [],
    driverRidesLoading: false,
    driverRidesError: null,
    lastDriverRidesFetch: null,

    currentRide: null,
    currentRideLoading: false,
    currentRideError: null,

    userRides: [],
    userRidesLoading: false,
    userRidesError: null,

    searchFilters: {},

      // Actions for all rides
      fetchAllRides: async (params = {}) => {
        const { lastDriverRidesFetch } = get();
        const now = Date.now();
        
        // Check cache for driver rides (5 minutes cache)
        if (params.driver_id && lastDriverRidesFetch && now - lastDriverRidesFetch < 5 * 60 * 1000) {
          return;
        }

        set({ allRidesLoading: true, allRidesError: null });

        try {
          const response = await ridesService.getRides(params);
          set({
            allRides: response.data || [],
            allRidesLoading: false,
            allRidesError: null,
            allRidesPagination: response.pagination,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch rides";
          set({
            allRidesLoading: false,
            allRidesError: errorMessage,
          });
        }
      },

      setAllRidesLoading: (loading) => {
        set({ allRidesLoading: loading });
      },

      setAllRidesError: (error) => {
        set({ allRidesError: error });
      },

      clearAllRides: () => {
        set({
          allRides: [],
          allRidesError: null,
          allRidesPagination: null,
        });
      },

      // Actions for driver rides
      fetchDriverRides: async (params = {}) => {
        const { lastDriverRidesFetch } = get();
        const now = Date.now();
        
        // Don't fetch if we already have recent data (5 minutes cache)
        if (lastDriverRidesFetch && now - lastDriverRidesFetch < 5 * 60 * 1000) {
          return;
        }

        set({ driverRidesLoading: true, driverRidesError: null });

        try {
          // If no specific params are provided, fetch ALL rides (both upcoming and past)
          // This ensures the dashboard has complete data for filtering
          const data = await ridesService.getDriverRides(params);
          
          set({
            driverRides: data,
            driverRidesLoading: false,
            driverRidesError: null,
            lastDriverRidesFetch: now,
          });
        } catch (error) {
          console.error("Error fetching driver rides:", error);
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch driver rides";
          set({
            driverRidesLoading: false,
            driverRidesError: errorMessage,
          });
        }
      },

      refreshDriverRides: async () => {
        // Force refresh by clearing cache
        set({ lastDriverRidesFetch: null });
        await get().fetchDriverRides();
      },

      setUpcomingDriverRides: async () => {
        await get().fetchDriverRides({ upcoming: true });
      },

      setPastDriverRides: async () => {
        await get().fetchDriverRides({ past: true });
      },

      setDriverRidesLoading: (loading) => {
        set({ driverRidesLoading: loading });
      },

      setDriverRidesError: (error) => {
        set({ driverRidesError: error });
      },

      clearDriverRides: () => {
        set({
          driverRides: [],
          driverRidesError: null,
          lastDriverRidesFetch: null,
        });
      },

      // Actions for current ride
      fetchRideById: async (rideId: string) => {
        set({ currentRideLoading: true, currentRideError: null });

        try {
          const data = await ridesService.getRideById(rideId);
          set({
            currentRide: data,
            currentRideLoading: false,
            currentRideError: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch ride";
          set({
            currentRideLoading: false,
            currentRideError: errorMessage,
          });
        }
      },

      setCurrentRide: (ride) => {
        set({ currentRide: ride });
      },

      setCurrentRideLoading: (loading) => {
        set({ currentRideLoading: loading });
      },

      setCurrentRideError: (error) => {
        set({ currentRideError: error });
      },

      clearCurrentRide: () => {
        set({
          currentRide: null,
          currentRideError: null,
        });
      },

      // CRUD actions
      createRide: async (rideData: CreateRideRequest) => {
        try {
          const newRide = await ridesService.createRide(rideData);
          // Refresh driver rides to include the new ride
          await get().refreshDriverRides();
          return newRide;
        } catch (error) {
          console.error("Error creating ride:", error);
          throw error;
        }
      },

      updateRide: async (rideId: string, updateData: UpdateRideRequest) => {
        try {
          const updatedRide = await ridesService.updateRide(rideId, updateData);
          // Update the ride in driver rides if it exists
          const { driverRides } = get();
          const updatedDriverRides = driverRides.map(ride => 
            ride.id === rideId ? { ...ride, ...updatedRide } : ride
          );
          set({ driverRides: updatedDriverRides });
          
          // Update current ride if it's the same
          const { currentRide } = get();
          if (currentRide?.id === rideId) {
            set({ currentRide: { ...currentRide, ...updatedRide } });
          }
          
          return updatedRide;
        } catch (error) {
          console.error("Error updating ride:", error);
          throw error;
        }
      },

      deleteRide: async (rideId: string) => {
        try {
          await ridesService.deleteRide(rideId);
          // Remove the ride from driver rides
          const { driverRides } = get();
          const filteredDriverRides = driverRides.filter(ride => ride.id !== rideId);
          set({ driverRides: filteredDriverRides });
          
          // Clear current ride if it's the same
          const { currentRide } = get();
          if (currentRide?.id === rideId) {
            set({ currentRide: null });
          }
        } catch (error) {
          console.error("Error deleting ride:", error);
          throw error;
        }
      },

      // Fetch user rides for messages/chat
      fetchUserRides: async (userId: string) => {
        set({ userRidesLoading: true, userRidesError: null });
        try {
          const rides = await ridesService.fetchUserRides(userId);
          set({ 
            userRides: rides, 
            userRidesLoading: false 
          });
        } catch (error) {
          console.error("Error fetching user rides:", error);
          set({ 
            userRidesError: error instanceof Error ? error.message : "Failed to fetch user rides",
            userRidesLoading: false 
          });
          throw error;
        }
      },

      // Search actions
      searchRides: async (filters) => {
        set({ allRidesLoading: true, allRidesError: null });

        try {
          const response = await ridesService.searchRides(filters);
          set({
            allRides: response.data || [],
            allRidesLoading: false,
            allRidesError: null,
            allRidesPagination: response.pagination,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to search rides";
          set({
            allRidesLoading: false,
            allRidesError: errorMessage,
          });
        }
      },

      setSearchFilters: (filters) => {
        set((state) => ({
          searchFilters: { ...state.searchFilters, ...filters },
        }));
      },

      clearSearchFilters: () => {
        set({ searchFilters: {} });
      },
    }),
    {
      name: 'rides-storage',
      // Only persist the data, not loading states
      partialize: (state) => ({
        driverRides: state.driverRides,
        lastDriverRidesFetch: state.lastDriverRidesFetch,
        searchFilters: state.searchFilters,
      }),
    }
  )
);
