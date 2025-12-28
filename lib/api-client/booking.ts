import { apiClient } from './index';
import type { 
  Booking, 
  CreateBookingRequest, 
  UpdateBookingRequest,
  BookingWithDetails,
  DriverBooking 
} from '@/types';

export interface BookingApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BookingSearchParams {
  userId?: string;
  rideId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Booking API client methods
 */
export class BookingApiClient {
  /**
   * Create a new booking
   */
  async createBooking(params: CreateBookingRequest & { user_id: string }): Promise<BookingApiResponse<Booking>> {
    return apiClient.post('/api/bookings', params);
  }

  /**
   * Get bookings for a user
   */
  async getUserBookings(userId: string, params?: BookingSearchParams): Promise<BookingApiResponse<BookingWithDetails[]>> {
    const searchParams = new URLSearchParams({
      userId,
      ...(params?.status && { status: params.status }),
      ...(params?.page && { page: params.page.toString() }),
      ...(params?.limit && { limit: params.limit.toString() }),
    });

    return apiClient.get(`/api/bookings?${searchParams}`);
  }

  /**
   * Get bookings for a driver
   */
  async getDriverBookings(driverId: string, params?: BookingSearchParams): Promise<BookingApiResponse<DriverBooking[]>> {
    const searchParams = new URLSearchParams({
      driverId,
      ...(params?.status && { status: params.status }),
      ...(params?.page && { page: params.page.toString() }),
      ...(params?.limit && { limit: params.limit.toString() }),
    });

    return apiClient.get(`/api/bookings/driver?${searchParams}`);
  }

  /**
   * Update booking
   */
  async updateBooking(bookingId: string, params: UpdateBookingRequest): Promise<BookingApiResponse<Booking>> {
    return apiClient.put(`/api/bookings/${bookingId}`, params);
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string): Promise<BookingApiResponse<void>> {
    return apiClient.delete(`/api/bookings/${bookingId}`);
  }

  /**
   * Verify booking code (driver only)
   */
  async verifyBookingCode(bookingId: string, verificationCode: string): Promise<BookingApiResponse<{ success: boolean; message: string }>> {
    return apiClient.post('/api/bookings/verify-code', {
      bookingId,
      verificationCode
    });
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<BookingApiResponse<BookingWithDetails>> {
    return apiClient.get(`/api/bookings/${bookingId}`);
  }

  /**
   * Check existing booking for a ride
   */
  async getExistingBookingForRide(rideId: string, userId: string): Promise<BookingApiResponse<Booking | null>> {
    const searchParams = new URLSearchParams({
      rideId,
      userId
    });

    return apiClient.get(`/api/bookings/existing?${searchParams}`);
  }

  /**
   * Check passenger info completeness (name and ID documents)
   */
  async checkPassengerInfo(userId: string): Promise<BookingApiResponse<{ isComplete: boolean; profileName: string }>> {
    const searchParams = new URLSearchParams({ userId });
    return apiClient.get(`/api/passengers/check-info?${searchParams}`);
  }
}

// Export singleton instance
export const bookingApiClient = new BookingApiClient();
