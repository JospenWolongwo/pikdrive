import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentOrchestratorService } from '@/lib/payment';
import { Environment as EnvEnum, FeatureFlag, PawaPayApiUrl } from '@/types/payment-ext';
import type { Environment } from '@/types/payment-ext';
import { BookingApiError } from './booking-errors';
import { assertOwner } from './booking-helpers';

export class ServerBookingRefundService {
  constructor(
    private supabase: SupabaseClient,
    private serviceSupabase?: SupabaseClient
  ) {}

  /**
   * Reduce seats on a paid booking and initiate partial refund
   */
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
    const { bookingId, userId, newSeats } = params;
    const adminSupabase = this.serviceSupabase ?? this.supabase;

    if (!newSeats || newSeats < 1) {
      throw new BookingApiError('Invalid seat count', 400);
    }

    const { data: booking } = await this.supabase
      .from('bookings')
      .select('id, user_id, seats, payment_status, code_verified, ride:ride_id(id, price)')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new BookingApiError('Booking not found', 404);
    }

    assertOwner(booking as { user_id?: string }, userId);

    if (booking.code_verified === true) {
      throw new BookingApiError(
        'Seat reduction is not allowed after the driver has verified the code and been paid. Your trip is confirmed.',
        403
      );
    }

    if (newSeats >= booking.seats) {
      throw new BookingApiError('Use booking update to add seats', 400);
    }

    if (booking.payment_status !== 'completed') {
      throw new BookingApiError('Can only reduce seats for paid bookings', 400);
    }

    const seatsToRemove = booking.seats - newSeats;
    const pricePerSeat = (booking.ride as { price?: number } | null)?.price;
    if (!pricePerSeat) {
      throw new BookingApiError('Ride price not found', 400);
    }

    const refundAmount = seatsToRemove * pricePerSeat;

    const { data: payments } = await this.supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (!payments || payments.length === 0) {
      throw new BookingApiError('No completed payments found', 400);
    }

    const primaryPayment = payments[0];

    const { error: bookingUpdateError } = await this.supabase
      .from('bookings')
      .update({
        seats: newSeats,
        payment_status: 'partial',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (bookingUpdateError) {
      throw new BookingApiError(`Failed to update booking: ${bookingUpdateError.message}`, 500);
    }

    const targetEnvironment = (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
    const pawaPayEnvironment = (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment;

    const orchestrator = new PaymentOrchestratorService(
      {
        subscriptionKey: process.env.DIRECT_MOMO_APIM_SUBSCRIPTION_KEY || process.env.MOMO_SUBSCRIPTION_KEY || '',
        apiKey: process.env.DIRECT_MOMO_API_KEY || process.env.MOMO_API_KEY || '',
        targetEnvironment,
        callbackHost: process.env.MOMO_CALLBACK_HOST || process.env.NEXT_PUBLIC_APP_URL || '',
        collectionPrimaryKey: process.env.DIRECT_MOMO_COLLECTION_PRIMARY_KEY || process.env.MOMO_COLLECTION_PRIMARY_KEY || '',
        collectionUserId: process.env.DIRECT_MOMO_COLLECTION_USER_ID || process.env.MOMO_COLLECTION_USER_ID || '',
        disbursementApiUser: process.env.DIRECT_MOMO_API_USER_DISBURSMENT || process.env.MOMO_DISBURSEMENT_API_USER,
        disbursementApiKey: process.env.DIRECT_MOMO_API_KEY_DISBURSMENT || process.env.MOMO_DISBURSEMENT_API_KEY,
        disbursementSubscriptionKey: process.env.DIRECT_MOMO_APIM_PAY_OUT_SUBSCRIPTION_KEY || process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
      },
      {
        merchantId: process.env.DIRECT_OM_MERCHAND_NUMBER || process.env.ORANGE_MONEY_MERCHANT_ID || '',
        merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || '',
        environment: (process.env.DIRECT_OM_ENVIRONMENT || process.env.ORANGE_MONEY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
        notificationUrl: process.env.DIRECT_OM_CALLBACK_URL || process.env.ORANGE_MONEY_NOTIFICATION_URL || '',
        returnUrl: process.env.ORANGE_MONEY_RETURN_URL || '',
        consumerUser: process.env.DIRECT_OM_CONSUMER_USER,
        consumerSecret: process.env.DIRECT_OM_CONSUMER_SECRET,
        apiUsername: process.env.DIRECT_OM_API_USERNAME,
        apiPassword: process.env.DIRECT_OM_API_PASSWORD,
        pinCode: process.env.DIRECT_OM_PIN_CODE,
        merchantNumber: process.env.DIRECT_OM_MERCHAND_NUMBER,
        tokenUrl: process.env.DIRECT_OM_TOKEN_URL,
        baseUrl: process.env.DIRECT_OM_BASE_URL,
      },
      {
        apiToken: process.env.PAWAPAY_API_TOKEN || "",
        baseUrl: process.env.PAWAPAY_BASE_URL || (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION ? PawaPayApiUrl.PRODUCTION : PawaPayApiUrl.SANDBOX),
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/pawapay`,
        environment: pawaPayEnvironment,
      }
    );

    const refundResult = await orchestrator.refund({
      phoneNumber: primaryPayment.phone_number,
      amount: refundAmount,
      reason: `Partial cancellation: ${seatsToRemove} seat(s) removed`,
      originalPaymentId: primaryPayment.id,
      currency: primaryPayment.currency || 'XAF',
      bookingId: bookingId,
      userId: userId,
    });

    const usePawaPay = process.env.USE_PAWAPAY === FeatureFlag.USE_PAWAPAY;
    const refundProvider = usePawaPay ? 'pawapay' : primaryPayment.provider;

    if (refundResult.response.success) {
      console.log('âœ… [PARTIAL REFUND] Refund initiated successfully');

      const { error: refundInsertError } = await adminSupabase.from('refunds').insert({
        payment_id: primaryPayment.id,
        booking_id: bookingId,
        user_id: userId,
        amount: refundAmount,
        currency: primaryPayment.currency || 'XAF',
        provider: refundProvider,
        phone_number: primaryPayment.phone_number,
        transaction_id: refundResult.response.refundId,
        status: 'processing',
        refund_type: 'partial',
        reason: `Reduced from ${booking.seats} to ${newSeats} seats`,
        metadata: {
          original_seats: booking.seats,
          new_seats: newSeats,
          seats_removed: seatsToRemove,
          price_per_seat: pricePerSeat,
          refundInitiatedAt: new Date().toISOString(),
          refund_provider: refundProvider,
          original_payment_provider: primaryPayment.provider,
        },
      });

      const { error: paymentUpdateError } = await adminSupabase
        .from('payments')
        .update({ status: 'partial_refund', updated_at: new Date().toISOString() })
        .eq('id', primaryPayment.id);

      if (refundInsertError) {
        console.error('âŒ [PARTIAL REFUND] Failed to create refund record:', refundInsertError);
      }
      if (paymentUpdateError) {
        console.error('âŒ [PARTIAL REFUND] Failed to update payment status to partial_refund:', paymentUpdateError);
      }
    } else {
      console.error('âŒ [PARTIAL REFUND] Refund failed:', refundResult.response.message);

      const { error: failedRefundInsertError } = await adminSupabase.from('refunds').insert({
        payment_id: primaryPayment.id,
        booking_id: bookingId,
        user_id: userId,
        amount: refundAmount,
        currency: primaryPayment.currency || 'XAF',
        provider: refundProvider,
        phone_number: primaryPayment.phone_number,
        status: 'failed',
        refund_type: 'partial',
        reason: `Reduced from ${booking.seats} to ${newSeats} seats`,
        metadata: {
          original_seats: booking.seats,
          new_seats: newSeats,
          seats_removed: seatsToRemove,
          error: refundResult.response.message,
          refundFailedAt: new Date().toISOString(),
          refund_provider: refundProvider,
          original_payment_provider: primaryPayment.provider,
        },
      });

      if (failedRefundInsertError) {
        console.error('âŒ [PARTIAL REFUND] Failed to create failed refund record:', failedRefundInsertError);
      }
    }

    return {
      refundInitiated: refundResult.response.success,
      refundAmount,
      newSeats,
      seatsRemoved: seatsToRemove,
    };
  }
}
