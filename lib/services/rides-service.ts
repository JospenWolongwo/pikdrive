import { apiClient } from "@/lib/api-client";
import type { 
  Ride, 
  RideWithDetails, 
  CreateRideRequest, 
  UpdateRideRequest,
  ApiResponse,
  PaginatedResponse 
} from "@/types";

/**
 * Service for rides API calls using the centralized apiClient
 */
export class RidesService {
  /**
   * Fetch all rides with optional filtering and pagination
   */
  async getRides(params?: {
    driver_id?: string;
    from_city?: string;
    to_city?: string;
    min_price?: number;
    max_price?: number;
    min_seats?: number;
    upcoming?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Ride>> {
    try {
      const searchParams = new URLSearchParams();
      
      if (params?.driver_id) searchParams.set("driver_id", params.driver_id);
      if (params?.from_city) searchParams.set("from_city", params.from_city);
      if (params?.to_city) searchParams.set("to_city", params.to_city);
      if (params?.min_price) searchParams.set("min_price", params.min_price.toString());
      if (params?.max_price) searchParams.set("max_price", params.max_price.toString());
      if (params?.min_seats) searchParams.set("min_seats", params.min_seats.toString());
      if (params?.upcoming) searchParams.set("upcoming", "true");
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.limit) searchParams.set("limit", params.limit.toString());

      const queryString = searchParams.toString();
      const endpoint = queryString ? `/api/rides?${queryString}` : "/api/rides";

      const response = await apiClient.get<PaginatedResponse<Ride>>(endpoint);

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch rides");
      }

      return response;
    } catch (error) {
      console.error("Error fetching rides:", error);
      throw error;
    }
  }

  /**
   * Fetch a single ride by ID with full details
   */
  async getRideById(rideId: string): Promise<RideWithDetails> {
    try {
      const response = await apiClient.get<ApiResponse<RideWithDetails>>(`/api/rides/${rideId}`);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch ride");
      }

      return response.data;
    } catch (error) {
      console.error("Error fetching ride:", error);
      throw error;
    }
  }

  /**
   * Create a new ride
   */
  async createRide(rideData: CreateRideRequest): Promise<Ride> {
    try {
      const response = await apiClient.post<ApiResponse<Ride>>("/api/rides", rideData);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to create ride");
      }

      return response.data;
    } catch (error) {
      console.error("Error creating ride:", error);
      throw error;
    }
  }

  /**
   * Update an existing ride
   */
  async updateRide(rideId: string, updateData: UpdateRideRequest): Promise<Ride> {
    try {
      const response = await apiClient.put<ApiResponse<Ride>>(`/api/rides/${rideId}`, updateData);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to update ride");
      }

      return response.data;
    } catch (error) {
      console.error("Error updating ride:", error);
      throw error;
    }
  }

  /**
   * Delete a ride
   */
  async deleteRide(rideId: string): Promise<void> {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/api/rides/${rideId}`);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete ride");
      }
    } catch (error) {
      console.error("Error deleting ride:", error);
      throw error;
    }
  }

  /**
   * Fetch rides for the current driver with optional filtering
   * If no params are provided, fetches ALL rides (both upcoming and past)
   */
  async getDriverRides(params?: {
    upcoming?: boolean;
    past?: boolean;
  }): Promise<RideWithDetails[]> {
    try {
      const searchParams = new URLSearchParams();
      
      // Only add query parameters if they are explicitly provided
      if (params?.upcoming === true) searchParams.set("upcoming", "true");
      if (params?.past === true) searchParams.set("past", "true");

      const queryString = searchParams.toString();
      const endpoint = queryString ? `/api/rides/driver?${queryString}` : "/api/rides/driver";
      
      const response = await apiClient.get<ApiResponse<RideWithDetails[]>>(endpoint);

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch driver rides");
      }

      return response.data || [];
    } catch (error) {
      console.error("Error fetching driver rides:", error);
      throw error;
    }
  }

  /**
   * Get upcoming rides for the current driver
   */
  async getUpcomingDriverRides(): Promise<RideWithDetails[]> {
    return this.getDriverRides({ upcoming: true });
  }

  /**
   * Get past rides for the current driver
   */
  async getPastDriverRides(): Promise<RideWithDetails[]> {
    return this.getDriverRides({ past: true });
  }

  /**
   * Search rides with filters (for passenger view)
   */
  async searchRides(filters: {
    from_city?: string;
    to_city?: string;
    min_price?: number;
    max_price?: number;
    min_seats?: number;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Ride>> {
    return this.getRides({
      ...filters,
      upcoming: true, // Only show upcoming rides for search
    });
  }
}

/**
 * Default instance of the rides service
 */
export const ridesService = new RidesService();
