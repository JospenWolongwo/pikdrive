import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { FeeCalculator } from '@/lib/payment/fee-calculator';
import { PaymentOrchestratorService } from '@/lib/payment/payment-orchestrator.service';
import type { Environment } from '@/types/payment-ext';
import { Environment as EnvEnum, PawaPayApiUrl } from '@/types/payment-ext';

export async function POST(request: Request) {
  try {
    const supabase = createApiSupabaseClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { bookingId, verificationCode } = body;

    if (!bookingId || !verificationCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if the booking exists with payment information (seats needed for partial payout)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, ride_id, status, payment_status, seats')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Fetch ride to verify driver and get price (needed for partial payout)
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('id, driver_id, price')
      .eq('id', booking.ride_id)
      .single();

    if (rideError || !ride) {
      return NextResponse.json(
        { error: 'Ride not found' },
        { status: 404 }
      );
    }

    // Ensure user is the driver of the ride
    if (ride.driver_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the driver can verify ride codes' },
        { status: 403 }
      );
    }

    // Check payment status BEFORE calling RPC so we never set code_verified when we will reject.
    // Allow 'completed' (full) and 'partial' (seat reduction: one or more paid seats remaining).
    const allowedPaymentStatuses = ['completed', 'partial'];
    if (!allowedPaymentStatuses.includes(booking.payment_status)) {
      return NextResponse.json({
        success: false,
        message: 'Payment must be completed before verification'
      }, { status: 400 });
    }

    // Verify the code using our database function (only after payment check)
    const { data: isValid, error: verifyError } = await supabase.rpc(
      'verify_booking_code',
      { 
        booking_id: bookingId,
        submitted_code: verificationCode 
      }
    );

    if (verifyError) {
      console.error('Error verifying code:', verifyError);
      return NextResponse.json(
        { error: 'Failed to verify code' },
        { status: 500 }
      );
    }

    if (!isValid) {
      return NextResponse.json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Fetch payments: completed (full payout) or partial_refund (partial booking – payout from booking.seats * price)
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, amount, currency, provider, created_at, status')
      .eq('booking_id', bookingId)
      .in('status', ['completed', 'partial_refund'])
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
    }

    // Total amount for payout: from completed payments, or for partial booking from remaining seats × price
    const completedPayments = payments?.filter((p: { status: string }) => p.status === 'completed') ?? [];
    const completedTotal = completedPayments.reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0);
    const isPartialBooking = booking.payment_status === 'partial' && (payments?.length ?? 0) > 0 && completedTotal === 0;
    const ridePrice = typeof ride.price === 'number' ? ride.price : Number(ride.price);
    const totalAmount = completedTotal > 0
      ? completedTotal
      : (isPartialBooking && booking.seats != null && ridePrice >= 0 ? booking.seats * ridePrice : 0);

    if (isPartialBooking && totalAmount > 0) {
      console.log('💰 [PAYOUT] Partial booking: paying for remaining seats', {
        bookingId,
        seats: booking.seats,
        pricePerSeat: ridePrice,
        totalAmount,
      });
    }

    if (!payments || payments.length === 0) {
      console.warn('⚠️ [PAYOUT] No payments found for booking, skipping payout');
    }

    // Check if payout already processed (by payment ids or by booking_id for partial)
    let existingPayout = null;
    if (payments && payments.length > 0) {
      const paymentIds = payments.map((p: { id: string }) => p.id);
      const { data: existingPayouts } = await supabase
        .from('payouts')
        .select('id, status')
        .in('payment_id', paymentIds);
      
      if (existingPayouts && existingPayouts.length > 0) {
        existingPayout = existingPayouts[0];
        console.log('✅ [PAYOUT] Payout already exists for this booking:', {
          payoutId: existingPayout.id,
          status: existingPayout.status,
          paymentCount: payments.length,
        });
      }
    }
    if (!existingPayout) {
      const { data: payoutByBooking } = await supabase
        .from('payouts')
        .select('id, status')
        .eq('booking_id', bookingId)
        .maybeSingle();
      existingPayout = payoutByBooking;
    }

    // Always set code_verified = true so passenger UI and refetches see it (RPC already set it; this ensures API path and realtime/refetch consistency, including partial bookings where status stays 'confirmed')
    const { error: codeVerifiedError } = await supabase
      .from('bookings')
      .update({
        code_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (codeVerifiedError) {
      console.error('Error setting code_verified on booking:', codeVerifiedError);
    }

    // Set status to confirmed only when it was still pending or pending_verification
    if (booking.status === 'pending' || booking.status === 'pending_verification') {
      const { error: statusError } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (statusError) {
        console.error('Error updating booking status:', statusError);
      }
    }

    // Trigger driver payout when we have a total amount to pay and no existing payout
    let payoutResult = null;
    const primaryPayment = payments && payments.length > 0 ? payments[0] : null;
    if (payments && payments.length > 0 && !existingPayout && totalAmount > 0 && primaryPayment) {
      try {
        const paymentIds = payments.map((p: { id: string }) => p.id);
        
        // Validate currency consistency
        const currencies = [...new Set(payments.map(p => p.currency))];
        if (currencies.length > 1) {
          console.warn('⚠️ [PAYOUT] Multiple currencies detected in payments:', currencies);
          // Use most recent payment's currency
        }

        console.log('💰 [PAYOUT] Processing cumulative payout:', {
          bookingId,
          paymentCount: payments.length,
          paymentIds,
          individualAmounts: payments.map(p => ({ id: p.id, amount: p.amount })),
          totalAmount,
        });

        // Get driver phone number
        const { data: driverProfile, error: profileError } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();

        if (!profileError && driverProfile?.phone) {
          // Calculate driver earnings from CUMULATIVE total (original amount - fees - commission)
          const feeCalculation = FeeCalculator.calculate(totalAmount);
          
          console.log('💰 [PAYOUT] Calculating driver payout from cumulative total:', {
            bookingId,
            totalAmount,
            transactionFee: feeCalculation.transactionFee,
            commission: feeCalculation.commission,
            driverEarnings: feeCalculation.driverEarnings,
          });

          // Initialize payout orchestrator
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

          // Sandbox test number override (for testing payouts in sandbox)
          let payoutPhoneNumber = driverProfile.phone;
          const usePawaPay = process.env.USE_PAWAPAY === 'true';
          
          if (usePawaPay) {
            // For pawaPay, check PAWAPAY_ENVIRONMENT, not MOMO_TARGET_ENVIRONMENT
            if (pawaPayEnvironment === EnvEnum.SANDBOX) {
              const sandboxPawaPayTestPhone = process.env.SANDBOX_PAWAPAY_TEST_PHONE;
              if (sandboxPawaPayTestPhone) {
                payoutPhoneNumber = sandboxPawaPayTestPhone;
                console.log('🧪 [PAYOUT] Sandbox pawaPay test number override active:', {
                  originalPhone: driverProfile.phone,
                  testPhone: sandboxPawaPayTestPhone,
                  note: 'Using pawaPay test number for sandbox payout testing',
                });
              }
            }
          } else {
            // For direct MTN/Orange, check MOMO_TARGET_ENVIRONMENT
            if (targetEnvironment === 'sandbox') {
              const sandboxTestPhone = process.env.SANDBOX_MTN_TEST_PHONE;
              if (sandboxTestPhone) {
                payoutPhoneNumber = sandboxTestPhone;
                console.log('🧪 [PAYOUT] Sandbox MTN test number override active:', {
                  originalPhone: driverProfile.phone,
                  testPhone: sandboxTestPhone,
                  note: 'Using test MTN number for sandbox payout testing',
                });
              }
            }
          }

          // Initiate payout with cumulative amount
          payoutResult = await orchestrator.payout({
            phoneNumber: payoutPhoneNumber,
            amount: feeCalculation.driverEarnings,
            reason: `PikDrive Ride Payment - Booking ${bookingId}${payments.length > 1 ? ` (${payments.length} payments)` : ''}`,
            currency: primaryPayment.currency || 'XAF',
            userId: user.id,
          });

          if (payoutResult.response.success) {
            console.log('✅ [PAYOUT] Driver payout initiated successfully:', {
              transactionId: payoutResult.response.verificationToken,
              amount: feeCalculation.driverEarnings,
              totalAmount,
              paymentCount: payments.length,
              driverPhone: driverProfile.phone,
            });

            // Create payout record in database with cumulative data
            const { error: payoutRecordError } = await supabase
              .from('payouts')
              .insert({
                driver_id: user.id,
                booking_id: bookingId,
                payment_id: primaryPayment.id, // Most recent payment (for DB constraint)
                amount: feeCalculation.driverEarnings,
                original_amount: totalAmount, // Cumulative total from all payments
                transaction_fee: feeCalculation.transactionFee,
                commission: feeCalculation.commission,
                currency: primaryPayment.currency || 'XAF',
                provider: usePawaPay ? 'pawapay' : (primaryPayment.provider || 'mtn'),
                phone_number: driverProfile.phone,
                transaction_id: payoutResult.response.verificationToken,
                status: 'processing',
                reason: `PikDrive Ride Payment - Booking ${bookingId}${payments.length > 1 ? ` (${payments.length} payments)` : ''}`,
                metadata: {
                  payment_ids: paymentIds, // Track ALL payment IDs included in this payout
                  payment_count: payments.length,
                  individual_amounts: payments.map(p => ({ id: p.id, amount: p.amount })),
                  apiResponse: payoutResult.response.apiResponse,
                  payoutInitiatedAt: new Date().toISOString(),
                },
              });

            if (payoutRecordError) {
              console.error('❌ [PAYOUT] Error creating payout record:', payoutRecordError);
              // Don't fail verification if record creation fails
            } else {
              console.log('✅ [PAYOUT] Payout record created successfully');
            }
          } else {
            console.error('❌ [PAYOUT] Driver payout failed:', payoutResult.response.message);
            
            // Create payout record with failed status and cumulative data
            const { data: failedPayout, error: payoutRecordError } = await supabase
              .from('payouts')
              .insert({
                driver_id: user.id,
                booking_id: bookingId,
                payment_id: primaryPayment.id, // Most recent payment
                amount: feeCalculation.driverEarnings,
                original_amount: totalAmount, // Cumulative total
                transaction_fee: feeCalculation.transactionFee,
                commission: feeCalculation.commission,
                currency: primaryPayment.currency || 'XAF',
                provider: primaryPayment.provider || 'mtn',
                phone_number: driverProfile.phone,
                status: 'failed',
                reason: `PikDrive Ride Payment - Booking ${bookingId}${payments.length > 1 ? ` (${payments.length} payments)` : ''}`,
                metadata: {
                  payment_ids: paymentIds,
                  payment_count: payments.length,
                  individual_amounts: payments.map(p => ({ id: p.id, amount: p.amount })),
                  error: payoutResult.response.message,
                  payoutFailedAt: new Date().toISOString(),
                },
              })
              .select()
              .single();

            if (payoutRecordError) {
              console.error('❌ [PAYOUT] Error creating failed payout record:', payoutRecordError);
            } else if (failedPayout) {
              // Send notification for initial failure (with deduplication)
              const { sendPayoutNotificationIfNeeded } = await import('@/lib/payment/payout-notification-helper');
              await sendPayoutNotificationIfNeeded(
                supabase,
                failedPayout,
                'failed',
                payoutResult.response.message || 'Échec de l\'initiation du paiement',
                'initial'
              );
            }
          }
        } else {
          console.warn('⚠️ [PAYOUT] Driver phone number not found, skipping payout');
        }
      } catch (payoutError) {
        console.error('❌ [PAYOUT] Error initiating driver payout:', payoutError);
        // Don't fail verification if payout fails - can be retried later
      }
    }

    // Calculate total earnings for response (uses same totalAmount as payout logic)
    const totalEarnings = totalAmount > 0 ? FeeCalculator.calculate(totalAmount).driverEarnings : null;

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
      payoutInitiated: payoutResult?.response.success || false,
      driverEarnings: totalEarnings,
      paymentCount: payments?.length || 0,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to verify code'
      },
      { status: 500 }
    );
  }
}
