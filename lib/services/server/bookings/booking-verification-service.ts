import type { SupabaseClient } from '@supabase/supabase-js';
import { BookingApiError } from './booking-errors';
import { assertOwner, assertOwnerOrDriver, getBookingOrThrow } from './booking-helpers';

export class ServerBookingVerificationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Verify booking code (driver only)
   */
  async verifyBookingCode(
    bookingId: string,
    verificationCode: string
  ): Promise<boolean> {
    try {
      const { data: isValid, error } = await this.supabase.rpc(
        'verify_booking_code',
        {
          booking_id: bookingId,
          submitted_code: verificationCode,
        }
      );

      if (error) {
        throw new Error(`Failed to verify booking code: ${error.message}`);
      }

      return isValid;
    } catch (error) {
      console.error('ServerBookingService.verifyBookingCode error:', error);
      throw error;
    }
  }

  /**
   * Get verification code info for a booking (owner or driver only)
   */
  async getVerificationCodeForUser(
    bookingId: string,
    userId: string
  ): Promise<{
    verificationCode: string | null;
    codeVerified: boolean;
    codeExpiry: string | null;
  }> {
    try {
      const booking = await getBookingOrThrow<{
        user_id?: string;
        ride_id?: string | null;
        verification_code?: string | null;
        code_expiry?: string | null;
        code_verified?: boolean | null;
      }>(this.supabase, bookingId, 'user_id, ride_id, verification_code, code_expiry, code_verified');

      await assertOwnerOrDriver(this.supabase, booking, userId);

      const codeVerified = Boolean(booking.code_verified);
      return {
        verificationCode: codeVerified ? null : (booking.verification_code ?? null),
        codeVerified,
        codeExpiry: booking.code_expiry ?? null,
      };
    } catch (error) {
      if (error instanceof BookingApiError) throw error;
      console.error('ServerBookingService.getVerificationCodeForUser error:', error);
      throw error;
    }
  }

  /**
   * Generate a verification code for a booking (owner or driver only)
   */
  async generateVerificationCodeForUser(
    bookingId: string,
    userId: string
  ): Promise<{ verificationCode: string | null }> {
    const booking = await getBookingOrThrow<{
      user_id?: string;
      ride_id?: string | null;
    }>(this.supabase, bookingId, 'user_id, ride_id');

    await assertOwnerOrDriver(this.supabase, booking, userId);

    const { data, error } = await this.supabase.rpc(
      'generate_booking_verification_code',
      { booking_id: bookingId }
    );

    if (error) {
      throw new BookingApiError('Failed to generate verification code', 500);
    }

    return { verificationCode: data ?? null };
  }

  /**
   * Refresh verification code for a booking (owner only)
   */
  async refreshVerificationCodeForOwner(
    bookingId: string,
    userId: string
  ): Promise<{ verificationCode: string | null; codeExpiry: string | null }> {
    const booking = await getBookingOrThrow<{
      user_id?: string;
      status?: string | null;
      payment_status?: string | null;
    }>(this.supabase, bookingId, 'user_id, status, payment_status');

    assertOwner(booking, userId);

    if (booking.status !== 'confirmed' && booking.payment_status !== 'completed') {
      throw new BookingApiError(
        'Booking must be confirmed and paid to generate verification code',
        400
      );
    }

    const { error: codeError } = await this.supabase.rpc(
      'generate_booking_verification_code',
      { booking_id: bookingId }
    );

    if (codeError) {
      throw new BookingApiError('Failed to generate verification code', 500);
    }

    const { data: codeData, error: fetchError } = await this.supabase.rpc(
      'get_booking_verification_code',
      { booking_id: bookingId }
    );

    if (fetchError || !codeData || codeData.length === 0) {
      throw new BookingApiError('Generated code could not be verified', 500);
    }

    return {
      verificationCode: codeData[0].verification_code ?? null,
      codeExpiry: codeData[0].code_expiry ?? null,
    };
  }
}
