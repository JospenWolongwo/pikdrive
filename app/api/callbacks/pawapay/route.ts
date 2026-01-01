import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';
import { mapPawaPayStatus } from '@/lib/payment/status-mapper';
import { TransactionType, HTTP_CODE } from '@/types/payment-ext';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * pawaPay Callback Handler
 * Handles webhooks from pawaPay for both deposits and payouts
 * PRIMARY mechanism for real-time status updates
 */
export async function POST(request: NextRequest) {
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

    // Get callback payload
    const callback = await request.json();
    console.log('[CALLBACK] pawaPay callback received:', callback);

    // pawaPay callbacks can be for deposits or payouts
    // Extract common fields
    const {
      depositId,
      payoutId,
      status,
      transactionId,
      externalId,
      amount,
      failureReason,
      type, // 'deposit' or 'payout'
    } = callback;

    // Determine if this is a deposit or payout callback
    const isDeposit = !!depositId || type === TransactionType.DEPOSIT;
    const isPayout = !!payoutId || type === TransactionType.PAYOUT;

    // Get the transaction ID (depositId or payoutId)
    const transactionReferenceId = depositId || payoutId || externalId || transactionId;

    if (!transactionReferenceId) {
      console.error('[CALLBACK] No transaction reference in pawaPay callback');
      // Return 200 to acknowledge receipt (prevents retries)
      return NextResponse.json(
        { error: 'Missing transaction reference' },
        { status: HTTP_CODE.OK }
      );
    }

    console.log('[CALLBACK] Processing pawaPay callback:', {
      isDeposit,
      isPayout,
      transactionReferenceId,
      status,
    });

    if (isDeposit) {
      // Handle deposit callback
      let payment = await paymentService.getPaymentByTransactionId(transactionReferenceId);

      // If not found by transaction ID, try to find by payment ID
      if (!payment && transactionReferenceId) {
        try {
          const { data } = await supabase
            .from("payments")
            .select("*")
            .eq("id", transactionReferenceId)
            .single();
          if (data) payment = data as any;
        } catch (e) {
          console.log("Payment not found by ID:", transactionReferenceId);
        }
      }

      if (!payment) {
        console.error('[CALLBACK] Payment not found:', transactionReferenceId);
        // Return 200 to acknowledge receipt (prevents retries)
        return NextResponse.json(
          { message: 'Callback received, payment not found' },
          { status: HTTP_CODE.OK }
        );
      }

      // Map pawaPay status to internal status
      const mappedStatus = mapPawaPayStatus(status);

      // Skip orchestration if payment is already in the target status
      // This prevents "Invalid payment state transition: completed → completed" errors
      if (payment.status === mappedStatus) {
        console.log('[CALLBACK] Payment already in target status, skipping orchestration:', {
          payment_id: payment.id,
          status: payment.status,
        });
        return NextResponse.json({ message: 'Callback received' }, { status: HTTP_CODE.OK });
      }

      // Update payment status via orchestration service
      await orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
        transaction_id: transactionId || transactionReferenceId,
        provider_response: callback,
        error_message: failureReason || undefined,
      });

      console.log('[CALLBACK] pawaPay deposit callback processed successfully');
    } else if (isPayout) {
      // Handle payout callback
      // Find payout record
      let payout;
      try {
        const { data } = await supabase
          .from("payouts")
          .select("*")
          .eq("transaction_id", transactionReferenceId)
          .single();
        if (data) payout = data as any;
      } catch (e) {
        console.log("Payout not found by transaction_id:", transactionReferenceId);
      }

      if (!payout) {
        console.error('[CALLBACK] Payout not found:', transactionReferenceId);
        // Return 200 to acknowledge receipt (prevents retries)
        return NextResponse.json(
          { message: 'Callback received, payout not found' },
          { status: HTTP_CODE.OK }
        );
      }

      // Map pawaPay status to payout status
      const mappedStatus = mapPawaPayStatus(status);

      // Update payout status
      const { error: updateError } = await supabase
        .from("payouts")
        .update({
          status: mappedStatus,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(payout.metadata || {}),
            lastCallback: new Date().toISOString(),
            callbackData: callback,
            transactionId: transactionId || transactionReferenceId,
            failureReason: failureReason || null,
          },
        })
        .eq("id", payout.id);

      if (updateError) {
        console.error('[CALLBACK] Error updating payout:', updateError);
      } else {
        console.log('[CALLBACK] pawaPay payout callback processed successfully');
      }
    } else {
      console.warn('[CALLBACK] Unknown callback type:', callback);
    }

    // Always return 200 OK immediately to acknowledge receipt
    // This prevents pawaPay from retrying
    return NextResponse.json({ message: 'Callback received' }, { status: HTTP_CODE.OK });
  } catch (error) {
    console.error('[CALLBACK] pawaPay callback error:', error);
    // Return 200 to prevent retries on our errors
    return NextResponse.json(
      { message: 'Callback received' },
      { status: HTTP_CODE.OK }
    );
  }
}

