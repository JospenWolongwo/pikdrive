import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { 
  Ride, 
  RideWithDetails, 
  RideWithDriver,
  CreateRideRequest, 
  UpdateRideRequest,
  PaginatedResponse 
} from "@/types";
import { ridesApiClient } from "@/lib/api-client/rides";
import { ApiError } from "@/lib/api-client/error";

interface RidesState {
  // All rides state (for search/browse)
  allRides: RideWithDriver[];
  allRidesLoading: boolean;
  allRidesError: string | null;
  lastAllRidesFetch: number | null;
  allRidesPagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  } | null;
  realTimeChannel: any | null; // Supabase realtime channel for seat updates

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
  subscribeToRideUpdates: (supabase: SupabaseClient) => void;
  unsubscribeFromRideUpdates: () => void;

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
  addDriverRide: (ride: RideWithDetails) => void;

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
    lastAllRidesFetch: null,
    allRidesPagination: null,
    realTimeChannel: null,

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
        const { lastAllRidesFetch } = get();
        const now = Date.now();
        
        // Check cache (5 minutes cache)
        if (lastAllRidesFetch && now - lastAllRidesFetch < 5 * 60 * 1000) {
          return;
        }

        set({ allRidesLoading: true, allRidesError: null });

        try {
          const response = await ridesApiClient.getRides(params);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch rides');
          }
          
          set({
            allRides: response.data || [],
            allRidesLoading: false,
            allRidesError: null,
            allRidesPagination: response.pagination,
            lastAllRidesFetch: now,
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

      refreshAllRides: async (params = {}) => {
        // Force refresh by clearing cache
        set({ lastAllRidesFetch: null });
        await get().fetchAllRides(params);
      },

      clearAllRides: () => {
        set({
          allRides: [],
          allRidesError: null,
          lastAllRidesFetch: null,
          allRidesPagination: null,
        });
      },
      
      // Subscribe to real-time ride seat updates
      subscribeToRideUpdates: (supabase: SupabaseClient) => {
        const { allRides, realTimeChannel } = get();
        
        // Unsubscribe from existing channel if any
        if (realTimeChannel) {
          supabase.removeChannel(realTimeChannel);
        }
        
        if (allRides.length === 0) return;
        
        const rideIds = allRides.map(ride => ride.id);
        
        console.log('🔔 [RIDES STORE] Subscribing to real-time updates for rides:', rideIds);
        
        const channel = supabase
          .channel('passenger-rides-updates')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'rides',
            filter: `id=in.(${rideIds.join(',')})`,
          }, (payload) => {
            console.log('🔄 [RIDES STORE] Ride updated via real-time:', payload.new);
            
            const updatedRide = payload.new;
            
            // Update the specific ride in the allRides array
            set((state) => ({
              allRides: state.allRides.map(ride =>
                ride.id === updatedRide.id
                  ? { 
                      ...ride, 
                      seats_available: updatedRide.seats_available,
                      updated_at: updatedRide.updated_at
                    }
                  : ride
              )
            }));
          })
          .subscribe((status) => {
            console.log('📡 [RIDES STORE] Real-time subscription status:', status);
          });
        
        set({ realTimeChannel: channel });
      },
      
      // Unsubscribe from real-time updates
      unsubscribeFromRideUpdates: () => {
        const { realTimeChannel } = get();
        
        if (realTimeChannel) {
          console.log('🔕 [RIDES STORE] Unsubscribing from real-time updates');
          // Note: This assumes supabase is available, but we can't access it here
          // The caller should handle cleanup
          set({ realTimeChannel: null });
        }
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
          const response = await ridesApiClient.getDriverRides(params);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch driver rides');
          }
          
          set({
            driverRides: response.data || [],
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

      addDriverRide: (ride: RideWithDetails) => {
        set((state) => ({
          // Add to the beginning (newest first)
          driverRides: [ride, ...state.driverRides],
          lastDriverRidesFetch: Date.now(), // Mark as fresh
        }));
        console.log('✅ [RIDES STORE] Added driver ride optimistically:', {
          id: ride.id,
          from: ride.from_city,
          to: ride.to_city,
          seats: ride.seats_available
        });
      },

      // Actions for current ride
      fetchRideById: async (rideId: string) => {
        console.log("🔄 [STORE] fetchRideById called for:", rideId);
        set({ currentRideLoading: true, currentRideError: null });

        try {
          const response = await ridesApiClient.getRideById(rideId);
          console.log("📦 [STORE] API response received:", { 
            success: response.success, 
            hasData: !!response.data,
            error: response.error 
          });
          
          if (!response.success || !response.data) {
            const errorMsg = response.error || 'Failed to fetch ride details';
            console.error("❌ [STORE] API returned error:", errorMsg);
            throw new Error(errorMsg);
          }
          
          console.log("✅ [STORE] Setting currentRide:", response.data.id);
          set({
            currentRide: response.data,
            currentRideLoading: false,
            currentRideError: null,
          });
        } catch (error) {
          console.error("❌ [STORE] Error in fetchRideById:", error);
          // Handle ApiError from API client
          let errorMessage = "Failed to fetch ride";
          
          if (error instanceof ApiError) {
            // ApiError has data property with the JSON response
            const errorData = error.data;
            if (typeof errorData === 'object' && errorData !== null) {
              errorMessage = errorData.error || errorData.message || error.getDisplayMessage();
            } else {
              errorMessage = error.getDisplayMessage();
            }
            console.error("❌ [STORE] ApiError details:", { status: error.status, message: errorMessage });
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          
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
          const response = await ridesApiClient.createRide(rideData);
          
          if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to create ride');
          }
          
          // Refresh driver rides to include the new ride
          await get().refreshDriverRides();
          return response.data;
        } catch (error) {
          console.error("Error creating ride:", error);
          throw error;
        }
      },

      updateRide: async (rideId: string, updateData: UpdateRideRequest) => {
        try {
          const response = await ridesApiClient.updateRide(rideId, updateData);
          
          if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to update ride');
          }
          
          const updatedRide = response.data;
          
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
          const response = await ridesApiClient.deleteRide(rideId);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to delete ride');
          }
          
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
          const response = await ridesApiClient.fetchUserRides(userId);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch user rides');
          }
          
          set({ 
            userRides: response.data || [], 
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
          const response = await ridesApiClient.searchRides(filters);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to search rides');
          }
          
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
        allRides: state.allRides,
        lastAllRidesFetch: state.lastAllRidesFetch,
        driverRides: state.driverRides,
        lastDriverRidesFetch: state.lastDriverRidesFetch,
        searchFilters: state.searchFilters,
      }),
    }
  )
);
