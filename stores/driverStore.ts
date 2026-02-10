import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RideWithPassengers } from "@/types";
import { apiClient } from "@/lib/api-client";
import { createPersistConfig, CACHE_LIMITS, trimArray } from "@/lib/storage";

interface DriverState {
  // Reservations state
  reservations: RideWithPassengers[];
  reservationsLoading: boolean;
  reservationsError: string | null;
  lastFetched: number | null;

  // Rides state (for future use)
  rides: any[];
  ridesLoading: boolean;
  ridesError: string | null;

  // Actions
  fetchReservations: () => Promise<void>;
  refreshReservations: () => Promise<void>;
  clearReservations: () => void;
  setReservationsLoading: (loading: boolean) => void;
  setReservationsError: (error: string | null) => void;
}

type DriverPersistedState = Pick<
  DriverState,
  "reservations" | "lastFetched" | "rides"
>;

export const useDriverStore = create<DriverState>()(
  persist(
    (set, get) => ({
      // Initial state
      reservations: [],
      reservationsLoading: false,
      reservationsError: null,
      lastFetched: null,
      rides: [],
      ridesLoading: false,
      ridesError: null,

      // Actions
      fetchReservations: async () => {
        const { lastFetched } = get();
        const now = Date.now();
        
        // Don't fetch if we already have recent data (5 minutes cache)
        if (lastFetched && now - lastFetched < 5 * 60 * 1000) {
          return;
        }

        set({ reservationsLoading: true, reservationsError: null });

        try {
          const response = await apiClient.get<any>("/api/driver/reservations");
          
          // Handle the actual API response structure: {success: true, rides: [...]}
          if (!response.success || !response.rides) {
            throw new Error(response.error || "Failed to fetch reservations");
          }
          
          set({
            reservations: response.rides,
            reservationsLoading: false,
            reservationsError: null,
            lastFetched: now,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch reservations";
          set({
            reservationsLoading: false,
            reservationsError: errorMessage,
          });
        }
      },

      refreshReservations: async () => {
        // Force refresh by clearing cache
        set({ lastFetched: null });
        await get().fetchReservations();
      },

      clearReservations: () => {
        set({
          reservations: [],
          reservationsError: null,
          lastFetched: null,
        });
      },

      setReservationsLoading: (loading) => {
        set({ reservationsLoading: loading });
      },

      setReservationsError: (error) => {
        set({ reservationsError: error });
      },
    }),
    createPersistConfig<DriverState, DriverPersistedState>("driver-storage", {
      // Persist data only; trim to keep storage bounded
      partialize: (state) => ({
        reservations: trimArray(state.reservations, CACHE_LIMITS.driverReservations),
        lastFetched: state.lastFetched,
        rides: trimArray(state.rides, CACHE_LIMITS.driverRides),
      }),
    })
  )
);
