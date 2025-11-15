import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { FeeCalculator } from '@/lib/payment/fee-calculator';
import { PayoutOrchestratorService } from '@/lib/payment/payout-orchestrator.service';

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

    // Check if the booking exists with payment information
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, ride_id, status, payment_status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Fetch ride to verify driver
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('id, driver_id')
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

    // Verify the code using our database function
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

    // Check if payment was completed
    if (booking.payment_status !== 'completed') {
      return NextResponse.json({
        success: false,
        message: 'Payment must be completed before verification'
      });
    }

    // Check if payout already processed (prevent duplicate payouts)
    const { data: existingPayout } = await supabase
      .from('payments')
      .select('id, status')
      .eq('booking_id', bookingId)
      .eq('provider', 'mtn') // Assuming MTN for now, can be made dynamic
      .eq('status', 'completed')
      .single();

    // Fetch payment to get amount
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, amount, currency, provider')
      .eq('booking_id', bookingId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (paymentError || !payment) {
      console.error('Error fetching payment:', paymentError);
      // Continue with verification even if payment fetch fails
    }

    // Update booking status to confirmed if it was pending or pending_verification
    if (booking.status === 'pending' || booking.status === 'pending_verification') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'confirmed',
          code_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (updateError) {
        console.error('Error updating booking status:', updateError);
        // Continue even if update fails, as the code verification was successful
      }
    }

    // Trigger driver payout if payment exists and not already processed
    let payoutResult = null;
    if (payment && !existingPayout) {
      try {
        // Get driver phone number
        const { data: driverProfile, error: profileError } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();

        if (!profileError && driverProfile?.phone) {
          // Calculate driver earnings (original amount - fees - commission)
          const feeCalculation = FeeCalculator.calculate(payment.amount);
          
          console.log('💰 [PAYOUT] Calculating driver payout:', {
            bookingId,
            originalAmount: payment.amount,
            transactionFee: feeCalculation.transactionFee,
            commission: feeCalculation.commission,
            driverEarnings: feeCalculation.driverEarnings,
          });

          // Initialize payout orchestrator
          const orchestrator = new PayoutOrchestratorService(
            {
              subscriptionKey: process.env.DIRECT_MOMO_APIM_SUBSCRIPTION_KEY || process.env.MOMO_SUBSCRIPTION_KEY || '',
              apiKey: process.env.DIRECT_MOMO_API_KEY || process.env.MOMO_API_KEY || '',
              targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
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
            }
          );

          // Initiate payout
          payoutResult = await orchestrator.payout({
            phoneNumber: driverProfile.phone,
            amount: feeCalculation.driverEarnings,
            reason: `PikDrive Ride Payment - Booking ${bookingId}`,
            currency: payment.currency || 'XAF',
            userId: user.id,
          });

          if (payoutResult.response.success) {
            console.log('✅ [PAYOUT] Driver payout initiated successfully:', {
              transactionId: payoutResult.response.verificationToken,
              amount: feeCalculation.driverEarnings,
              driverPhone: driverProfile.phone,
            });
          } else {
            console.error('❌ [PAYOUT] Driver payout failed:', payoutResult.response.message);
          }
        } else {
          console.warn('⚠️ [PAYOUT] Driver phone number not found, skipping payout');
        }
      } catch (payoutError) {
        console.error('❌ [PAYOUT] Error initiating driver payout:', payoutError);
        // Don't fail verification if payout fails - can be retried later
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
      payoutInitiated: payoutResult?.response.success || false,
      driverEarnings: payment ? FeeCalculator.calculate(payment.amount).driverEarnings : null,
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
