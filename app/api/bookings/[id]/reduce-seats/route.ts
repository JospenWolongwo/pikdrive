import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { PaymentOrchestratorService } from '@/lib/payment/payment-orchestrator.service';
import type { Environment } from '@/types/payment-ext';
import { Environment as EnvEnum, PawaPayApiUrl } from '@/types/payment-ext';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createApiSupabaseClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { newSeats } = body; // Number of seats to keep

    if (!newSeats || newSeats < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid seat count' },
        { status: 400 }
      );
    }

    // Get current booking with ride info
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, ride:ride_id(id, price)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Block seat reduction once driver has verified code (driver already paid – protect company)
    if (booking.code_verified === true) {
      return NextResponse.json(
        {
          success: false,
          error: 'Seat reduction is not allowed after the driver has verified the code and been paid. Your trip is confirmed.',
          errorCode: 'CODE_VERIFIED_NO_REDUCE',
        },
        { status: 403 }
      );
    }

    // Validate: can't increase seats via this endpoint
    if (newSeats >= booking.seats) {
      return NextResponse.json(
        { success: false, error: 'Use booking update to add seats' },
        { status: 400 }
      );
    }

    // Validate: only for paid bookings
    if (booking.payment_status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Can only reduce seats for paid bookings' },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const seatsToRemove = booking.seats - newSeats;
    const pricePerSeat = booking.ride.price;
    const refundAmount = seatsToRemove * pricePerSeat;

    // Get payment details
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', params.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (!payments || payments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No completed payments found' },
        { status: 400 }
      );
    }

    const primaryPayment = payments[0];

    // Update booking (reduce seats)
    // Note: Use 'partial' for bookings (partial_refund is for payments only)
    // The booking still has some paid seats, so 'partial' is more accurate
    await supabase.from('bookings').update({
      seats: newSeats,
      payment_status: 'partial', // Use 'partial' instead of 'partial_refund' for bookings
      updated_at: new Date().toISOString(),
    }).eq('id', params.id);

    // Restore seats to ride
    await supabase.rpc('restore_seats_to_ride', {
      p_ride_id: booking.ride_id,
      p_seats: seatsToRemove,
    });

    // Initialize orchestrator for refund processing
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
    
    // Process partial refund
    const refundResult = await orchestrator.refund({
      phoneNumber: primaryPayment.phone_number,
      amount: refundAmount,
      reason: `Partial cancellation: ${seatsToRemove} seat(s) removed`,
      originalPaymentId: primaryPayment.id,
      currency: primaryPayment.currency || 'XAF',
      bookingId: params.id,
      userId: user.id,
    });

    if (refundResult.response.success) {
      console.log('✅ [PARTIAL REFUND] Refund initiated successfully');
      
      // Create refund record
      await supabase.from('refunds').insert({
        payment_id: primaryPayment.id,
        booking_id: params.id,
        user_id: user.id,
        amount: refundAmount,
        currency: primaryPayment.currency || 'XAF',
        provider: primaryPayment.provider,
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
        },
      });

      // Update payment status to partial_refund
      await supabase
        .from('payments')
        .update({ status: 'partial_refund', updated_at: new Date().toISOString() })
        .eq('id', primaryPayment.id);
    } else {
      console.error('❌ [PARTIAL REFUND] Refund failed:', refundResult.response.message);
      
      // Create failed refund record
      await supabase.from('refunds').insert({
        payment_id: primaryPayment.id,
        booking_id: params.id,
        user_id: user.id,
        amount: refundAmount,
        currency: primaryPayment.currency || 'XAF',
        provider: primaryPayment.provider,
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
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Seats reduced successfully',
      refundInitiated: refundResult.response.success,
      refundAmount,
      newSeats,
      seatsRemoved: seatsToRemove,
    });
  } catch (error) {
    console.error('Partial cancellation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to reduce seats' },
      { status: 500 }
    );
  }
}
