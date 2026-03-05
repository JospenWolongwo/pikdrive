import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateRideRequest,
  Ride,
  RideWithDetails,
  RideWithDriver,
  UpdateRideRequest,
} from "@/types";
import { ServerBookingPolicyService } from "./bookings/booking-policy-service";
import type { DriverRidesParams, GetRidesParams } from "./rides/shared";
import { RideApiError } from "./rides/shared";
import {
  getDriverRidesOperation,
  getRideByIdForApiOperation,
  getRideByIdOperation,
  getRidesOperation,
  getUserRidesOperation,
} from "./rides/read-operations";
import {
  createRideForApiOperation,
  createRideOperation,
  deleteRideByDriverOperation,
  deleteRideOperation,
  updateRideByDriverOperation,
  updateRideOperation,
} from "./rides/write-operations";

export { RideApiError } from "./rides/shared";

/**
 * Server-side RidesService for use in API routes
 * Uses direct Supabase client access (no HTTP calls)
 */
export class ServerRidesService {
  private readonly bookingPolicyService = new ServerBookingPolicyService();

  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all rides with filtering and pagination
   */
  async getRides(params?: GetRidesParams) {
    return getRidesOperation({ supabase: this.supabase }, params);
  }

  /**
   * Get ride by ID with full details
   */
  async getRideById(rideId: string): Promise<RideWithDetails | null> {
    return getRideByIdOperation({ supabase: this.supabase }, rideId);
  }

  /**
   * Get ride by ID for API: driver + bookings with user profiles and enriched pickup names.
   * Throws RideApiError(404) if not found.
   */
  async getRideByIdForApi(rideId: string): Promise<RideWithDetails> {
    return getRideByIdForApiOperation(
      {
        supabase: this.supabase,
        bookingPolicyService: this.bookingPolicyService,
      },
      rideId
    );
  }

  /**
   * Create ride for API: verifies driver role, validates input and pickup points, inserts and returns enriched ride.
   * Throws RideApiError(403|400|500) as appropriate.
   */
  async createRideForApi(
    userId: string,
    rideData: CreateRideRequest
  ): Promise<RideWithDriver> {
    return createRideForApiOperation(
      { supabase: this.supabase },
      userId,
      rideData
    );
  }

  /**
   * Create a new ride
   */
  async createRide(rideData: CreateRideRequest, driverId: string): Promise<Ride> {
    return createRideOperation({ supabase: this.supabase }, rideData, driverId);
  }

  /**
   * Update ride by driver: checks ownership, validates pickup_points, updates and returns enriched ride.
   * Throws RideApiError(404|403|400|500) as appropriate.
   */
  async updateRideByDriver(
    rideId: string,
    userId: string,
    updateData: UpdateRideRequest
  ): Promise<RideWithDetails> {
    return updateRideByDriverOperation(
      { supabase: this.supabase },
      rideId,
      userId,
      updateData
    );
  }

  /**
   * Update an existing ride
   */
  async updateRide(rideId: string, updateData: UpdateRideRequest): Promise<Ride> {
    return updateRideOperation({ supabase: this.supabase }, rideId, updateData);
  }

  /**
   * Delete ride by driver: checks ownership and ensures no booking history exists.
   * Throws RideApiError(404|403|400|500) as appropriate.
   */
  async deleteRideByDriver(rideId: string, userId: string): Promise<void> {
    return deleteRideByDriverOperation({ supabase: this.supabase }, rideId, userId);
  }

  /**
   * Delete a ride
   */
  async deleteRide(rideId: string): Promise<void> {
    return deleteRideOperation({ supabase: this.supabase }, rideId);
  }

  /**
   * Get rides for a specific driver
   */
  async getDriverRides(
    driverId: string,
    params?: DriverRidesParams
  ): Promise<RideWithDetails[]> {
    return getDriverRidesOperation({ supabase: this.supabase }, driverId, params);
  }

  /**
   * Get user rides (both as driver and passenger)
   */
  async getUserRides(userId: string): Promise<Ride[]> {
    return getUserRidesOperation({ supabase: this.supabase }, userId);
  }
}

