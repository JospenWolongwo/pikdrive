import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerBookingService } from '@/lib/services/server/booking-service';
import { ServerOneSignalNotificationService } from '@/lib/services/server/onesignal-notification-service';
import { PaymentOrchestratorService } from '@/lib/payment/payment-orchestrator.service';
import type { Environment } from '@/types/payment-ext';
import { Environment as EnvEnum, PawaPayApiUrl } from '@/types/payment-ext';
import { getTranslation, formatAmount } from '@/lib/utils/server-translations';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createApiSupabaseClient();
    const bookingService = new ServerBookingService(supabase);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const booking = await bookingService.getBookingById(params.id);

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Booking fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch booking'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createApiSupabaseClient();
    const bookingService = new ServerBookingService(supabase);
    
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
    const { status, payment_status, code_verified, seats } = body;

    // Update booking
    const booking = await bookingService.updateBooking(params.id, {
      status,
      payment_status,
      code_verified,
      seats
    });

    return NextResponse.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Booking update error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update booking'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createApiSupabaseClient();
    const bookingService = new ServerBookingService(supabase);
    const notificationService = new ServerOneSignalNotificationService(supabase);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get booking details with ride information
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        ride:ride_id (
          *,
          driver:driver_id (
            id,
            full_name
          )
        ),
        user:user_id (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', params.id)
      .single();

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Fetch ALL completed payments for this booking
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount, currency, provider, phone_number, status, created_at')
      .eq('booking_id', params.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const hasPaidBooking = payments && payments.length > 0 && totalPaid > 0;

    // Cancel booking (restore seats)
    await bookingService.cancelBooking(params.id);

    // Process automatic refund if booking was paid
    let refundResult = null;
    let refundPhoneNumber = booking.user.phone; // Fallback to user's phone
    
    if (hasPaidBooking) {
      try {
        // Use phone number from most recent payment (cumulative strategy)
        const primaryPayment = payments[0];
        refundPhoneNumber = primaryPayment.phone_number;

        console.log('💸 [REFUND] Processing automatic refund:', {
          bookingId: params.id,
          totalAmount: totalPaid,
          phoneNumber: refundPhoneNumber,
          paymentCount: payments.length,
        });

        // Initialize orchestrator
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

        // Process refund (via payout API)
        refundResult = await orchestrator.refund({
          phoneNumber: refundPhoneNumber,
          amount: totalPaid,
          reason: `Booking cancellation: ${booking.ride.from_city} to ${booking.ride.to_city}`,
          originalPaymentId: primaryPayment.id,
          currency: primaryPayment.currency || 'XAF',
          bookingId: params.id,
          userId: user.id,
        });

        if (refundResult.response.success) {
          console.log('✅ [REFUND] Refund initiated successfully');

          // Create refund record
          await supabase.from('refunds').insert({
            payment_id: primaryPayment.id,
            booking_id: params.id,
            user_id: user.id,
            amount: totalPaid,
            currency: primaryPayment.currency || 'XAF',
            provider: primaryPayment.provider,
            phone_number: refundPhoneNumber,
            transaction_id: refundResult.response.refundId,
            status: 'processing',
            refund_type: 'full',
            reason: 'Full booking cancellation',
            metadata: {
              payment_ids: payments.map(p => p.id),
              payment_count: payments.length,
              individual_amounts: payments.map(p => ({ id: p.id, amount: p.amount })),
              apiResponse: refundResult.response.apiResponse,
              refundInitiatedAt: new Date().toISOString(),
            },
          });

          // Update all payment statuses to 'refunded'
          await supabase
            .from('payments')
            .update({ status: 'refunded', updated_at: new Date().toISOString() })
            .in('id', payments.map(p => p.id));

        } else {
          console.error('❌ [REFUND] Refund failed:', refundResult.response.message);
          
          // Create failed refund record for tracking
          await supabase.from('refunds').insert({
            payment_id: primaryPayment.id,
            booking_id: params.id,
            user_id: user.id,
            amount: totalPaid,
            currency: primaryPayment.currency || 'XAF',
            provider: primaryPayment.provider,
            phone_number: refundPhoneNumber,
            status: 'failed',
            refund_type: 'full',
            reason: 'Full booking cancellation',
            metadata: {
              payment_ids: payments.map(p => p.id),
              payment_count: payments.length,
              error: refundResult.response.message,
              refundFailedAt: new Date().toISOString(),
            },
          });
        }
      } catch (error) {
        console.error('❌ [REFUND] Exception processing refund:', error);
        // Don't fail cancellation if refund fails
      }
    }

    // Send notifications (push only, no SMS)
    await Promise.all([
      // Send push notification to driver (availability changed)
      notificationService.sendDriverNotification(
        booking.ride.driver.id,
        'booking_cancelled',
        {
          id: booking.id,
          rideId: booking.ride.id,
          passengerName: booking.user.full_name,
          from: booking.ride.from_city,
          to: booking.ride.to_city,
          date: booking.ride.departure_time,
          seats: booking.seats,
          amount: booking.total_amount,
        }
      ).catch(err => {
        console.error('❌ Driver cancellation notification error (non-critical):', err);
      }),

      // Send push notification to passenger (cancellation confirmation with refund info)
      (async () => {
        // Use translations (default to French locale for now)
        const locale: 'fr' | 'en' = 'fr';
        
        const refundMessage = hasPaidBooking && refundResult?.response.success
          ? getTranslation(locale, 'notifications.bookingCancelled.refundProcessing', {
              amount: formatAmount(totalPaid),
              phone: refundPhoneNumber,
            })
          : hasPaidBooking
          ? getTranslation(locale, 'notifications.bookingCancelled.refundProcessingGeneric')
          : '';

        const title = getTranslation(locale, 'notifications.bookingCancelled.title');
        const baseMessage = getTranslation(locale, 'notifications.bookingCancelled.message', {
          from: booking.ride.from_city,
          to: booking.ride.to_city,
        });

        return notificationService.sendNotification({
          userId: booking.user.id,
          title,
          message: `${baseMessage}${refundMessage ? ` ${refundMessage}` : ''}`,
          notificationType: 'booking_cancelled',
          imageUrl: '/icons/booking-cancelled.svg',
          sendSMS: false, // Push notification only
          data: {
            bookingId: booking.id,
            rideId: booking.ride.id,
            refundInitiated: refundResult?.response.success || false,
            refundAmount: totalPaid,
            refundPhoneNumber: refundPhoneNumber,
            type: 'booking_cancelled',
            icon: 'XCircle',
            action: 'view_bookings',
            deepLink: `/bookings/${booking.id}`,
            priority: 'high',
          },
        });
      })().catch(err => {
        console.error('❌ Passenger cancellation notification error (non-critical):', err);
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
      refundInitiated: refundResult?.response.success || false,
      refundAmount: totalPaid,
    });
  } catch (error) {
    console.error('Booking cancellation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cancel booking'
      },
      { status: 500 }
    );
  }
}