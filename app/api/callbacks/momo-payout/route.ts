import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ServerPaymentService, ServerPaymentOrchestrationService, ServerOneSignalNotificationService } from '@/lib/services/server';
import { mapMtnMomoStatus, sendPayoutNotificationIfNeeded } from '@/lib/payment';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // Initialize Supabase with service role for callback processing
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );
    
    const paymentService = new ServerPaymentService(supabase);
    const orchestrationService = new ServerPaymentOrchestrationService(supabase);
    const notificationService = new ServerOneSignalNotificationService(supabase);

    // Get the signature from headers
    const signature = request.headers.get('x-mtn-signature');
    console.log('🔐 MTN payout signature:', signature);
    
    // Get the callback payload
    const callback = await request.json();
    console.log('📦 MTN payout callback payload:', callback);

    // Extract transaction details from MOMO payout callback
    const {
      financialTransactionId,
      externalId,
      amount,
      currency,
      payee,
      payerMessage,
      status,
      reason,
    } = callback;

    if (!externalId) {
      console.error("❌ No externalId in MOMO payout callback");
      return NextResponse.json(
        { error: "Missing externalId" },
        { status: 400 }
      );
    }

    // Find payment by transaction ID (externalId is the payment ID or reference)
    let payment = await paymentService.getPaymentByTransactionId(externalId);

    // If not found by transaction ID, try to find by payment ID
    if (!payment && externalId) {
      try {
        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("id", externalId)
          .single();
        if (data) payment = data as any;
      } catch (e) {
        console.log("Payment not found by ID:", externalId);
      }
    }

    if (!payment) {
      console.error("❌ Payment not found for payout externalId:", externalId);
      // Return 200 to acknowledge receipt even if payment not found
      // (prevents MOMO from retrying)
      return NextResponse.json(
        { message: "Payout callback received, payment not found" },
        { status: 200 }
      );
    }

    // Map MOMO status to our payment status
    const mappedStatus = mapMtnMomoStatus(status);

    // Update payment status via orchestration service
    await orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
      transaction_id: financialTransactionId || externalId,
      provider_response: callback,
      error_message: reason || undefined,
    });

    // Update payout record status
    // Find payout by transaction_id (verificationToken) or payment_id from payment
    const transactionId = financialTransactionId || externalId;
    const { data: payouts, error: payoutQueryError } = await supabase
      .from('payouts')
      .select(`
        id,
        driver_id,
        booking_id,
        payment_id,
        amount,
        currency,
        transaction_id,
        metadata,
        booking:bookings(
          id,
          ride:rides(
            id,
            from_city,
            to_city
          )
        )
      `)
      .or(`transaction_id.eq.${transactionId},payment_id.eq.${payment.id}`)
      .limit(1);

    if (!payoutQueryError && payouts && payouts.length > 0) {
      const payout = payouts[0];
      // Map payment status to payout status
      let payoutStatus = 'processing';
      if (mappedStatus === 'completed') {
        payoutStatus = 'completed';
      } else if (mappedStatus === 'failed') {
        payoutStatus = 'failed';
      }

      const { error: payoutUpdateError } = await supabase
        .from('payouts')
        .update({
          status: payoutStatus,
          transaction_id: transactionId, // Update with actual transaction ID from callback
          metadata: {
            ...(payout.metadata || {}),
            callbackReceivedAt: new Date().toISOString(),
            callbackStatus: status,
            financialTransactionId: financialTransactionId,
            providerResponse: callback,
          },
        })
        .eq('id', payout.id);

      if (payoutUpdateError) {
        console.error('❌ Error updating payout status:', payoutUpdateError);
      } else {
        console.log('✅ Payout status updated:', { payoutId: payout.id, status: payoutStatus });

        // Fetch the updated payout to get the latest metadata (including callback fields)
        // This ensures the notification function has the current state and preserves callback metadata
        const { data: updatedPayout, error: fetchError } = await supabase
          .from('payouts')
          .select('id, driver_id, amount, currency, booking_id, transaction_id, metadata')
          .eq('id', payout.id)
          .single();

        if (fetchError) {
          console.error('❌ Error fetching updated payout:', fetchError);
          // Fallback: manually merge callback metadata into payout object
          const payoutToUse = {
            ...payout,
            status: payoutStatus,
            transaction_id: transactionId,
            metadata: {
              ...(payout.metadata || {}),
              callbackReceivedAt: new Date().toISOString(),
              callbackStatus: status,
              financialTransactionId: financialTransactionId,
              providerResponse: callback,
            },
          };

          // Send driver notification based on payout status (with deduplication)
          if (payoutStatus === 'completed' && payoutToUse.driver_id) {
            await sendPayoutNotificationIfNeeded(
              supabase,
              payoutToUse,
              'completed',
              undefined,
              'callback'
            );
          } else if (payoutStatus === 'failed' && payoutToUse.driver_id) {
            await sendPayoutNotificationIfNeeded(
              supabase,
              payoutToUse,
              'failed',
              reason || 'Raison inconnue',
              'callback'
            );
          }
        } else {
          // Use the freshly fetched payout with latest metadata
          // Send driver notification based on payout status (with deduplication)
          if (payoutStatus === 'completed' && updatedPayout.driver_id) {
            await sendPayoutNotificationIfNeeded(
              supabase,
              updatedPayout,
              'completed',
              undefined,
              'callback'
            );
          } else if (payoutStatus === 'failed' && updatedPayout.driver_id) {
            await sendPayoutNotificationIfNeeded(
              supabase,
              updatedPayout,
              'failed',
              reason || 'Raison inconnue',
              'callback'
            );
          }
        }
      }
    } else {
      console.log('⚠️ Payout record not found for transaction:', transactionId);
    }

    console.log('✅ MTN payout callback processed successfully');

    return NextResponse.json({ message: "Payout callback received" }, { status: 200 });
  } catch (error) {
    console.error('❌ MTN MOMO payout callback error:', error);
    // Return 200 to prevent retries on our errors
    return NextResponse.json(
      { message: 'Payout callback received' },
      { status: 200 }
    );
  }
}
