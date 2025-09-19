import { apiClient } from "@/lib/api-client";
import type { RideWithPassengers } from "@/types";

/**
 * Service for driver reservations API calls
 */
export class DriverReservationsService {
  /**
   * Fetch driver's rides with passenger bookings
   */
  async getDriverReservations(): Promise<RideWithPassengers[]> {
    try {
      const response = await apiClient.get<any>("/api/driver/reservations");

      // Handle the actual API response structure: {success: true, rides: [...]}
      if (!response.success || !response.rides) {
        throw new Error(response.error || "Failed to fetch reservations");
      }

      return response.rides;
    } catch (error) {
      console.error("Error fetching driver reservations:", error);
      throw error;
    }
  }

  /**
   * Refresh driver reservations (same as getDriverReservations but with explicit naming)
   */
  async refreshReservations(): Promise<RideWithPassengers[]> {
    return this.getDriverReservations();
  }
}

/**
 * Default instance of the driver reservations service
 */
export const driverReservationsService = new DriverReservationsService();
