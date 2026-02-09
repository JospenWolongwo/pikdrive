import type { SupabaseClient } from '@supabase/supabase-js';
import { FeeCalculator, PaymentOrchestratorService } from '@/lib/payment';
import { Environment as EnvEnum, PawaPayApiUrl } from '@/types/payment-ext';
import type { Environment } from '@/types/payment-ext';
import { BookingApiError } from './booking-errors';

export class ServerBookingPayoutService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Verify booking code and handle payout for driver
   */
  async verifyCodeAndHandlePayout(params: {
    bookingId: string;
    verificationCode: string;
    driverId: string;
  }): Promise<{
    payoutInitiated: boolean;
    driverEarnings: number | null;
    paymentCount: number;
  }> {
    const { bookingId, verificationCode, driverId } = params;

    if (!bookingId || !verificationCode) {
      throw new BookingApiError('Missing required fields', 400);
    }

    const { data: booking, error: bookingError } = await this.supabase
      .from('bookings')
      .select('id, ride_id, status, payment_status, seats')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new BookingApiError('Booking not found', 404);
    }

    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
      .select('id, driver_id, price')
      .eq('id', booking.ride_id)
      .single();

    if (rideError || !ride) {
      throw new BookingApiError('Ride not found', 404);
    }

    if (ride.driver_id !== driverId) {
      throw new BookingApiError('Only the driver can verify ride codes', 403);
    }

    const allowedPaymentStatuses = ['completed', 'partial'];
    if (!allowedPaymentStatuses.includes(booking.payment_status)) {
      throw new BookingApiError('Payment must be completed before verification', 400);
    }

    const { data: isValid, error: verifyError } = await this.supabase.rpc(
      'verify_booking_code',
      {
        booking_id: bookingId,
        submitted_code: verificationCode,
      }
    );

    if (verifyError) {
      console.error('Error verifying code:', verifyError);
      throw new BookingApiError('Failed to verify code', 500);
    }

    if (!isValid) {
      throw new BookingApiError('Invalid or expired verification code', 400);
    }

    const { data: payments, error: paymentsError } = await this.supabase
      .from('payments')
      .select('id, amount, currency, provider, created_at, status')
      .eq('booking_id', bookingId)
      .in('status', ['completed', 'partial_refund'])
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
    }

    const completedPayments =
      payments?.filter((p: { status: string }) => p.status === 'completed') ?? [];
    const completedTotal = completedPayments.reduce(
      (sum: number, p: { amount: number }) => sum + Number(p.amount),
      0
    );
    const isPartialBooking =
      booking.payment_status === 'partial' &&
      (payments?.length ?? 0) > 0 &&
      completedTotal === 0;
    const ridePrice = typeof ride.price === 'number' ? ride.price : Number(ride.price);
    const totalAmount =
      completedTotal > 0
        ? completedTotal
        : isPartialBooking && booking.seats != null && ridePrice >= 0
        ? booking.seats * ridePrice
        : 0;

    if (isPartialBooking && totalAmount > 0) {
      console.log('ðŸ’° [PAYOUT] Partial booking: paying for remaining seats', {
        bookingId,
        seats: booking.seats,
        pricePerSeat: ridePrice,
        totalAmount,
      });
    }

    if (!payments || payments.length === 0) {
      console.warn('âš ï¸ [PAYOUT] No payments found for booking, skipping payout');
    }

    let existingPayout = null;
    if (payments && payments.length > 0) {
      const paymentIds = payments.map((p: { id: string }) => p.id);
      const { data: existingPayouts } = await this.supabase
        .from('payouts')
        .select('id, status')
        .in('payment_id', paymentIds);

      if (existingPayouts && existingPayouts.length > 0) {
        existingPayout = existingPayouts[0];
        console.log('âœ… [PAYOUT] Payout already exists for this booking:', {
          payoutId: existingPayout.id,
          status: existingPayout.status,
          paymentCount: payments.length,
        });
      }
    }
    if (!existingPayout) {
      const { data: payoutByBooking } = await this.supabase
        .from('payouts')
        .select('id, status')
        .eq('booking_id', bookingId)
        .maybeSingle();
      existingPayout = payoutByBooking;
    }

    const { error: codeVerifiedError } = await this.supabase
      .from('bookings')
      .update({
        code_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (codeVerifiedError) {
      console.error('Error setting code_verified on booking:', codeVerifiedError);
    }

    if (booking.status === 'pending' || booking.status === 'pending_verification') {
      const { error: statusError } = await this.supabase
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

    let payoutResult = null;
    const primaryPayment = payments && payments.length > 0 ? payments[0] : null;
    if (payments && payments.length > 0 && !existingPayout && totalAmount > 0 && primaryPayment) {
      try {
        const paymentIds = payments.map((p: { id: string }) => p.id);
        const currencies = [...new Set(payments.map((p) => p.currency))];
        if (currencies.length > 1) {
          console.warn('âš ï¸ [PAYOUT] Multiple currencies detected in payments:', currencies);
        }

        console.log('ðŸ’° [PAYOUT] Processing cumulative payout:', {
          bookingId,
          paymentCount: payments.length,
          paymentIds,
          individualAmounts: payments.map((p) => ({ id: p.id, amount: p.amount })),
          totalAmount,
        });

        const { data: driverProfile, error: profileError } = await this.supabase
          .from('profiles')
          .select('phone')
          .eq('id', driverId)
          .single();

        if (!profileError && driverProfile?.phone) {
          const feeCalculation = FeeCalculator.calculate(totalAmount);

          console.log('ðŸ’° [PAYOUT] Calculating driver payout from cumulative total:', {
            bookingId,
            totalAmount,
            transactionFee: feeCalculation.transactionFee,
            commission: feeCalculation.commission,
            driverEarnings: feeCalculation.driverEarnings,
          });

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

          let payoutPhoneNumber = driverProfile.phone;
          const usePawaPay = process.env.USE_PAWAPAY === 'true';

          if (usePawaPay) {
            if (pawaPayEnvironment === EnvEnum.SANDBOX) {
              const sandboxPawaPayTestPhone = process.env.SANDBOX_PAWAPAY_TEST_PHONE;
              if (sandboxPawaPayTestPhone) {
                payoutPhoneNumber = sandboxPawaPayTestPhone;
                console.log('ðŸ§ª [PAYOUT] Sandbox pawaPay test number override active:', {
                  originalPhone: driverProfile.phone,
                  testPhone: sandboxPawaPayTestPhone,
                  note: 'Using pawaPay test number for sandbox payout testing',
                });
              }
            }
          } else if (targetEnvironment === 'sandbox') {
            const sandboxTestPhone = process.env.SANDBOX_MTN_TEST_PHONE;
            if (sandboxTestPhone) {
              payoutPhoneNumber = sandboxTestPhone;
              console.log('ðŸ§ª [PAYOUT] Sandbox MTN test number override active:', {
                originalPhone: driverProfile.phone,
                testPhone: sandboxTestPhone,
                note: 'Using test MTN number for sandbox payout testing',
              });
            }
          }

          payoutResult = await orchestrator.payout({
            phoneNumber: payoutPhoneNumber,
            amount: feeCalculation.driverEarnings,
            reason: `PikDrive Ride Payment - Booking ${bookingId}${payments.length > 1 ? ` (${payments.length} payments)` : ''}`,
            currency: primaryPayment.currency || 'XAF',
            userId: driverId,
          });

          if (payoutResult.response.success) {
            console.log('âœ… [PAYOUT] Driver payout initiated successfully:', {
              transactionId: payoutResult.response.verificationToken,
              amount: feeCalculation.driverEarnings,
              totalAmount,
              paymentCount: payments.length,
              driverPhone: driverProfile.phone,
            });

            const { error: payoutRecordError } = await this.supabase
              .from('payouts')
              .insert({
                driver_id: driverId,
                booking_id: bookingId,
                payment_id: primaryPayment.id,
                amount: feeCalculation.driverEarnings,
                original_amount: totalAmount,
                transaction_fee: feeCalculation.transactionFee,
                commission: feeCalculation.commission,
                currency: primaryPayment.currency || 'XAF',
                provider: usePawaPay ? 'pawapay' : (primaryPayment.provider || 'mtn'),
                phone_number: driverProfile.phone,
                transaction_id: payoutResult.response.verificationToken,
                status: 'processing',
                reason: `PikDrive Ride Payment - Booking ${bookingId}${payments.length > 1 ? ` (${payments.length} payments)` : ''}`,
                metadata: {
                  payment_ids: paymentIds,
                  payment_count: payments.length,
                  individual_amounts: payments.map((p) => ({ id: p.id, amount: p.amount })),
                  apiResponse: payoutResult.response.apiResponse,
                  payoutInitiatedAt: new Date().toISOString(),
                },
              });

            if (payoutRecordError) {
              console.error('âŒ [PAYOUT] Error creating payout record:', payoutRecordError);
            } else {
              console.log('âœ… [PAYOUT] Payout record created successfully');
            }
          } else {
            console.error('âŒ [PAYOUT] Driver payout failed:', payoutResult.response.message);

            const { data: failedPayout, error: payoutRecordError } = await this.supabase
              .from('payouts')
              .insert({
                driver_id: driverId,
                booking_id: bookingId,
                payment_id: primaryPayment.id,
                amount: feeCalculation.driverEarnings,
                original_amount: totalAmount,
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
                  individual_amounts: payments.map((p) => ({ id: p.id, amount: p.amount })),
                  error: payoutResult.response.message,
                  payoutFailedAt: new Date().toISOString(),
                },
              })
              .select()
              .single();

            if (payoutRecordError) {
              console.error('âŒ [PAYOUT] Error creating failed payout record:', payoutRecordError);
            } else if (failedPayout) {
              const { sendPayoutNotificationIfNeeded } = await import('@/lib/payment');
              await sendPayoutNotificationIfNeeded(
                this.supabase,
                failedPayout,
                'failed',
                payoutResult.response.message || "Ã‰chec de l'initiation du paiement",
                'initial'
              );
            }
          }
        } else {
          console.warn('âš ï¸ [PAYOUT] Driver phone number not found, skipping payout');
        }
      } catch (payoutError) {
        console.error('âŒ [PAYOUT] Error initiating driver payout:', payoutError);
      }
    }

    const totalEarnings =
      totalAmount > 0 ? FeeCalculator.calculate(totalAmount).driverEarnings : null;

    return {
      payoutInitiated: payoutResult?.response.success || false,
      driverEarnings: totalEarnings,
      paymentCount: payments?.length || 0,
    };
  }
}
