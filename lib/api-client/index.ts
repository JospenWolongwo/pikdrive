// Main API client exports
export { ApiClient } from './client';
export { ApiError } from './error';
export type { RequestOptions } from './types';

// Import for internal use
import { ApiClient } from './client';

/**
 * Create a new API client instance
 */
export const createApiClient = (baseUrl?: string): ApiClient => {
  return new ApiClient(baseUrl);
};

/**
 * Default API client instance for internal API calls
 */
export const apiClient = createApiClient();

// Export specialized API clients
export { bookingApiClient } from './booking';
export { paymentApiClient } from './payment';
export { ridesApiClient } from './rides';
export { chatApiClient } from './chat';
export { driverApiClient } from './driver';
export { adminApiClient } from './admin';
export { getPickupPointsByCity } from './pickup-points';
