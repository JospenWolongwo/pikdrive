import { apiClient } from './index';
import type { DriverPublicProfile } from '@/types/driver';
import type { ApiResponse } from '@/types';

/**
 * Driver API client methods
 * Client-side HTTP calls to driver API routes
 */
export class DriverApiClient {
  /**
   * Get public driver profile by ID
   */
  async getDriverProfile(driverId: string): Promise<ApiResponse<DriverPublicProfile>> {
    return apiClient.get<ApiResponse<DriverPublicProfile>>(`/api/drivers/${driverId}`);
  }
}

// Export singleton instance
export const driverApiClient = new DriverApiClient();

