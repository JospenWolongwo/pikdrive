import { apiClient } from './index';
import type { 
  Ride, 
  RideWithDetails, 
  RideWithDriver,
  CreateRideRequest, 
  UpdateRideRequest,
  ApiResponse,
  PaginatedResponse 
} from '@/types';

/**
 * Rides API client methods
 */
export class RidesApiClient {
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
  }): Promise<PaginatedResponse<RideWithDriver>> {
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

    return apiClient.get<PaginatedResponse<RideWithDriver>>(endpoint);
  }

  /**
   * Fetch a single ride by ID with full details
   */
  async getRideById(rideId: string): Promise<ApiResponse<RideWithDetails>> {
    return apiClient.get<ApiResponse<RideWithDetails>>(`/api/rides/${rideId}`);
  }

  /**
   * Create a new ride
   */
  async createRide(rideData: CreateRideRequest): Promise<ApiResponse<Ride>> {
    return apiClient.post<ApiResponse<Ride>>("/api/rides", rideData);
  }

  /**
   * Update an existing ride
   */
  async updateRide(rideId: string, updateData: UpdateRideRequest): Promise<ApiResponse<Ride>> {
    return apiClient.put<ApiResponse<Ride>>(`/api/rides/${rideId}`, updateData);
  }

  /**
   * Delete a ride
   */
  async deleteRide(rideId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<ApiResponse<void>>(`/api/rides/${rideId}`);
  }

  /**
   * Cancel a ride (driver initiated)
   */
  async cancelRide(
    rideId: string,
    reason?: string
  ): Promise<ApiResponse<{
    rideCancelled: boolean;
    rideAlreadyCancelled: boolean;
    activeBookingsFound: number;
    cancelledBookings: number;
    paidBookings: number;
    refundsInitiated: number;
    refundsFailed: number;
    notificationOnesignalSent: number;
    notificationWhatsAppSent: number;
    failedBookings: Array<{ bookingId: string; error: string }>;
  }>> {
    return apiClient.post<ApiResponse<{
      rideCancelled: boolean;
      rideAlreadyCancelled: boolean;
      activeBookingsFound: number;
      cancelledBookings: number;
      paidBookings: number;
      refundsInitiated: number;
      refundsFailed: number;
      notificationOnesignalSent: number;
      notificationWhatsAppSent: number;
      failedBookings: Array<{ bookingId: string; error: string }>;
    }>>(`/api/rides/${rideId}/cancel`, reason ? { reason } : {});
  }

  /**
   * Fetch rides for the current driver with optional filtering
   * If no params are provided, fetches ALL rides (both upcoming and past)
   */
  async getDriverRides(params?: {
    upcoming?: boolean;
    past?: boolean;
  }): Promise<ApiResponse<RideWithDetails[]>> {
    const searchParams = new URLSearchParams();
    
    // Only add query parameters if they are explicitly provided
    if (params?.upcoming === true) searchParams.set("upcoming", "true");
    if (params?.past === true) searchParams.set("past", "true");

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/api/rides/driver?${queryString}` : "/api/rides/driver";
    
    return apiClient.get<ApiResponse<RideWithDetails[]>>(endpoint);
  }

  /**
   * Get upcoming rides for the current driver
   */
  async getUpcomingDriverRides(): Promise<ApiResponse<RideWithDetails[]>> {
    return this.getDriverRides({ upcoming: true });
  }

  /**
   * Get past rides for the current driver
   */
  async getPastDriverRides(): Promise<ApiResponse<RideWithDetails[]>> {
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
  }): Promise<PaginatedResponse<RideWithDriver>> {
    return this.getRides({
      ...filters,
      upcoming: true, // Only show upcoming rides for search
    });
  }

  /**
   * Fetch user rides for messages/chat (both as driver and passenger)
   */
  async fetchUserRides(userId: string): Promise<ApiResponse<Ride[]>> {
    return apiClient.get<ApiResponse<Ride[]>>(`/api/rides/user/${userId}`);
  }
}

// Export singleton instance
export const ridesApiClient = new RidesApiClient();
