import { useCallback } from "react";
import { useRidesStore } from "@/stores";
import type { Ride } from "@/types";

/**
 * Hook for managing user rides (both as driver and passenger)
 * Used primarily for messages/chat functionality
 */
export function useUserRides() {
  const {
    userRides,
    userRidesLoading,
    userRidesError,
    fetchUserRides,
  } = useRidesStore();

  const loadUserRides = useCallback(async (userId: string) => {
    try {
      await fetchUserRides(userId);
    } catch (error) {
      console.error("Error loading user rides:", error);
    }
  }, [fetchUserRides]);

  return {
    userRides,
    userRidesLoading,
    userRidesError,
    loadUserRides,
  };
}
