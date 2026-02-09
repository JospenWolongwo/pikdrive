import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Booking,
  CreateBookingRequest,
  UpdateBookingRequest,
  BookingWithDetails,
  DriverBooking,
} from '@/types';
import type { BookingSearchParams } from './bookings/booking-types';
import { BookingApiError } from './bookings/booking-errors';
import { ServerBookingCoreService } from './bookings/booking-core-service';
import { ServerBookingVerificationService } from './bookings/booking-verification-service';
import { ServerBookingRefundService } from './bookings/booking-refund-service';
import { ServerBookingPayoutService } from './bookings/booking-payout-service';

export { BookingApiError };
export type { BookingSearchParams };

/**
 * Server-side BookingService for use in API routes
 * Uses direct Supabase client access (no HTTP calls)
 */
export class ServerBookingService {
  private coreService: ServerBookingCoreService;
  private verificationService: ServerBookingVerificationService;
  private refundService: ServerBookingRefundService;
  private payoutService: ServerBookingPayoutService;

  constructor(
    private supabase: SupabaseClient,
    private serviceSupabase?: SupabaseClient
  ) {
    this.coreService = new ServerBookingCoreService(supabase);
    this.verificationService = new ServerBookingVerificationService(supabase);
    this.refundService = new ServerBookingRefundService(supabase, serviceSupabase);
    this.payoutService = new ServerBookingPayoutService(supabase);
  }

  async createBooking(
    params: CreateBookingRequest & { user_id: string; selected_pickup_point_id?: string }
  ): Promise<Booking> {
    return this.coreService.createBooking(params);
  }

  async getUserBookings(params: BookingSearchParams): Promise<BookingWithDetails[]> {
    return this.coreService.getUserBookings(params);
  }

  async getDriverBookings(params: BookingSearchParams): Promise<DriverBooking[]> {
    return this.coreService.getDriverBookings(params);
  }

  async updateBooking(bookingId: string, params: UpdateBookingRequest): Promise<Booking> {
    return this.coreService.updateBooking(bookingId, params);
  }

  async cancelBooking(bookingId: string): Promise<void> {
    return this.coreService.cancelBooking(bookingId);
  }

  async verifyBookingCode(bookingId: string, verificationCode: string): Promise<boolean> {
    return this.verificationService.verifyBookingCode(bookingId, verificationCode);
  }

  async getBookingById(bookingId: string): Promise<BookingWithDetails | null> {
    return this.coreService.getBookingById(bookingId);
  }

  async getVerificationCodeForUser(
    bookingId: string,
    userId: string
  ): Promise<{ verificationCode: string | null; codeVerified: boolean; codeExpiry: string | null }> {
    return this.verificationService.getVerificationCodeForUser(bookingId, userId);
  }

  async generateVerificationCodeForUser(
    bookingId: string,
    userId: string
  ): Promise<{ verificationCode: string | null }> {
    return this.verificationService.generateVerificationCodeForUser(bookingId, userId);
  }

  async refreshVerificationCodeForOwner(
    bookingId: string,
    userId: string
  ): Promise<{ verificationCode: string | null; codeExpiry: string | null }> {
    return this.verificationService.refreshVerificationCodeForOwner(bookingId, userId);
  }

  async getExistingBookingForRide(
    rideId: string,
    userId: string
  ): Promise<Booking | null> {
    return this.coreService.getExistingBookingForRide(rideId, userId);
  }

  async calculateAdditionalPaymentAmount(
    bookingId: string,
    newSeats: number
  ): Promise<number> {
    return this.coreService.calculateAdditionalPaymentAmount(bookingId, newSeats);
  }

  async reduceSeatsWithRefund(params: {
    bookingId: string;
    userId: string;
    newSeats: number;
  }): Promise<{
    refundInitiated: boolean;
    refundAmount: number;
    newSeats: number;
    seatsRemoved: number;
  }> {
    return this.refundService.reduceSeatsWithRefund(params);
  }

  async verifyCodeAndHandlePayout(params: {
    bookingId: string;
    verificationCode: string;
    driverId: string;
  }): Promise<{
    payoutInitiated: boolean;
    driverEarnings: number | null;
    paymentCount: number;
  }> {
    return this.payoutService.verifyCodeAndHandlePayout(params);
  }
}
