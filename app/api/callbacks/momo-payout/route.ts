import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';
import { ServerOneSignalNotificationService } from '@/lib/services/server/onesignal-notification-service';
import { mapMtnMomoStatus } from '@/lib/payment/status-mapper';
import { sendPayoutNotificationIfNeeded } from '@/lib/payment/payout-notification-helper';

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

        // Send driver notification based on payout status (with deduplication)
        if (payoutStatus === 'completed' && payout.driver_id) {
          await sendPayoutNotificationIfNeeded(
            supabase,
            payout,
            'completed',
            undefined,
            'callback'
          );
        } else if (payoutStatus === 'failed' && payout.driver_id) {
          await sendPayoutNotificationIfNeeded(
            supabase,
            payout,
            'failed',
            reason || 'Raison inconnue',
            'callback'
          );
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
