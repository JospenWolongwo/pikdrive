import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerBookingService } from '@/lib/services/server/bookings';
import { ServerOneSignalNotificationService } from '@/lib/services/server/notifications';
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

    // Use atomic function to cancel booking and prepare refund record
    // This ensures both operations succeed or fail together
    let refundResult = null;
    let refundPhoneNumber = booking.user.phone; // Fallback to user's phone
    let refundRecordId: string | null = null;
    let cancellationResult: any = null;

    if (hasPaidBooking) {
      // Use phone number from most recent payment (cumulative strategy)
      const primaryPayment = payments[0];
      refundPhoneNumber = primaryPayment.phone_number;

      console.log('🔄 [CANCELLATION] Starting atomic cancellation with refund preparation:', {
        bookingId: params.id,
        userId: user.id,
        totalAmount: totalPaid,
        phoneNumber: refundPhoneNumber,
        paymentCount: payments.length,
        paymentIds: payments.map(p => p.id),
      });

      // Call atomic function: cancellation + refund record creation
      const { data: atomicResult, error: atomicError } = await supabase.rpc(
        'cancel_booking_with_refund_preparation',
        {
          p_booking_id: params.id,
          p_user_id: user.id,
          p_refund_amount: totalPaid,
          p_refund_currency: primaryPayment.currency || 'XAF',
          p_refund_provider: primaryPayment.provider,
          p_refund_phone_number: refundPhoneNumber,
          p_payment_ids: payments.map(p => p.id),
        }
      );

      if (atomicError) {
        console.error('❌ [CANCELLATION] Atomic cancellation failed:', {
          error: atomicError.message,
          code: atomicError.code,
          details: atomicError.details,
          hint: atomicError.hint,
          bookingId: params.id,
        });
        throw new Error(`Failed to cancel booking atomically: ${atomicError.message}`);
      }

      if (!atomicResult || atomicResult.length === 0) {
        console.error('❌ [CANCELLATION] Atomic function returned no result');
        throw new Error('Atomic cancellation returned no result');
      }

      cancellationResult = atomicResult[0];

      if (!cancellationResult.success) {
        console.error('❌ [CANCELLATION] Atomic cancellation failed:', {
          success: cancellationResult.success,
          booking_cancelled: cancellationResult.booking_cancelled,
          error_message: cancellationResult.error_message,
          debug_info: cancellationResult.debug_info,
          bookingId: params.id,
        });
        throw new Error(cancellationResult.error_message || 'Atomic cancellation failed');
      }

      refundRecordId = cancellationResult.refund_record_id;

      console.log('✅ [CANCELLATION] Atomic cancellation succeeded:', {
        bookingId: params.id,
        booking_cancelled: cancellationResult.booking_cancelled,
        refund_record_id: refundRecordId,
        debug_steps: cancellationResult.debug_info?.steps,
      });

      // Now process external refund API (after database transaction succeeded)
      try {
        console.log('💸 [REFUND] Processing external refund API call:', {
          bookingId: params.id,
          refundRecordId,
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
          console.log('✅ [REFUND] External refund API succeeded:', {
            refundRecordId,
            transactionId: refundResult.response.refundId,
            amount: totalPaid,
          });

          // Update existing refund record with transaction ID and status
          if (refundRecordId) {
            try {
              // Get existing metadata first to merge
              const { data: existingRefund, error: fetchError } = await supabase
                .from('refunds')
                .select('metadata')
                .eq('id', refundRecordId)
                .single();

              if (fetchError) {
                console.error('❌ [REFUND] Failed to fetch existing refund record:', {
                  refundRecordId,
                  error: fetchError.message,
                });
              }

              const existingMetadata = existingRefund?.metadata || {};
              
              const { error: updateError } = await supabase
                .from('refunds')
                .update({
                  transaction_id: refundResult.response.refundId,
                  status: 'processing',
                  updated_at: new Date().toISOString(),
                  metadata: {
                    ...existingMetadata,
                    payment_ids: payments.map(p => p.id),
                    payment_count: payments.length,
                    individual_amounts: payments.map(p => ({ id: p.id, amount: p.amount })),
                    apiResponse: refundResult.response.apiResponse,
                    refundInitiatedAt: new Date().toISOString(),
                    externalApiSuccess: true,
                    externalApiCalledAt: new Date().toISOString(),
                  },
                })
                .eq('id', refundRecordId);

              if (updateError) {
                console.error('❌ [REFUND] Failed to update refund record:', {
                  refundRecordId,
                  error: updateError.message,
                });
              } else {
                console.log('✅ [REFUND] Refund record updated with transaction ID');
              }
            } catch (err) {
              console.error('❌ [REFUND] Exception updating refund record:', err);
            }
          }

        } else {
          console.error('❌ [REFUND] External refund API failed:', {
            refundRecordId,
            error: refundResult.response.message,
            bookingId: params.id,
          });
          
          // Update existing refund record as failed
          if (refundRecordId) {
            try {
              // Get existing metadata first to merge
              const { data: existingRefund, error: fetchError } = await supabase
                .from('refunds')
                .select('metadata')
                .eq('id', refundRecordId)
                .single();

              if (fetchError) {
                console.error('❌ [REFUND] Failed to fetch existing refund record:', {
                  refundRecordId,
                  error: fetchError.message,
                });
              }

              const existingMetadata = existingRefund?.metadata || {};
              
              const { error: updateError } = await supabase
                .from('refunds')
                .update({
                  status: 'failed',
                  updated_at: new Date().toISOString(),
                  metadata: {
                    ...existingMetadata,
                    payment_ids: payments.map(p => p.id),
                    payment_count: payments.length,
                    error: refundResult.response.message,
                    refundFailedAt: new Date().toISOString(),
                    externalApiSuccess: false,
                    externalApiFailedAt: new Date().toISOString(),
                  },
                })
                .eq('id', refundRecordId);

              if (updateError) {
                console.error('❌ [REFUND] Failed to update refund record status:', {
                  refundRecordId,
                  error: updateError.message,
                });
              } else {
                console.log('⚠️ [REFUND] Refund record marked as failed (can be retried later)');
              }
            } catch (err) {
              console.error('❌ [REFUND] Exception updating refund record status:', err);
            }
          }
        }
      } catch (error) {
        console.error('❌ [REFUND] Exception processing external refund API:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          refundRecordId,
          bookingId: params.id,
        });
        
        // Update refund record as failed if it exists
        if (refundRecordId) {
          try {
            // Get existing metadata first to merge
            const { data: existingRefund } = await supabase
              .from('refunds')
              .select('metadata')
              .eq('id', refundRecordId)
              .single();

            const existingMetadata = existingRefund?.metadata || {};
            
            await supabase
              .from('refunds')
              .update({
                status: 'failed',
                updated_at: new Date().toISOString(),
                metadata: {
                  ...existingMetadata,
                  error: error instanceof Error ? error.message : String(error),
                  exceptionAt: new Date().toISOString(),
                  externalApiSuccess: false,
                  externalApiExceptionAt: new Date().toISOString(),
                },
              })
              .eq('id', refundRecordId);
          } catch (err) {
            console.error('❌ [REFUND] Failed to update refund record after exception:', err);
          }
        }
        
        // Note: Booking is already cancelled, refund can be retried later
        // We don't throw here to avoid blocking the cancellation response
      }
    } else {
      // No paid booking - just cancel without refund
      console.log('🔄 [CANCELLATION] Cancelling unpaid booking:', {
        bookingId: params.id,
        userId: user.id,
      });

      const { data: cancelResult, error: cancelError } = await supabase.rpc(
        'cancel_booking_and_restore_seats',
        { p_booking_id: params.id }
      );

      if (cancelError) {
        console.error('❌ [CANCELLATION] Booking cancellation failed:', {
          error: cancelError.message,
          code: cancelError.code,
          details: cancelError.details,
          hint: cancelError.hint,
          bookingId: params.id,
        });
        throw new Error(`Failed to cancel booking: ${cancelError.message}`);
      }

      if (!cancelResult) {
        console.error('❌ [CANCELLATION] Cancellation function returned false');
        throw new Error('Failed to cancel booking');
      }

      console.log('✅ [CANCELLATION] Unpaid booking cancelled successfully');
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
      refundRecordId: refundRecordId,
      cancellationDebugInfo: cancellationResult?.debug_info || null,
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