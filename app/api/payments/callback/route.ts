import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerPaymentService, ServerPaymentOrchestrationService } from '@/lib/services/server/payment';
import { mapMtnMomoStatus, mapOrangeMoneyStatus } from '@/lib/payment/status-mapper';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const paymentService = new ServerPaymentService(supabase);
    const orchestrationService = new ServerPaymentOrchestrationService(supabase);

    // Get callback data
    const callbackData = await request.json();
    
    // Determine provider from request URL
    const url = new URL(request.url);
    const provider = url.pathname.includes('orange') ? 'orange' : 'mtn';
    
    console.log(`[CALLBACK] Received ${provider.toUpperCase()} callback:`, callbackData);

    let referenceId, providerStatus, reason, financialTransactionId;

    if (provider === 'orange') {
      // Extract Orange Money callback data
      referenceId = callbackData.externalId || callbackData.transactionId;
      providerStatus = callbackData.status;
      reason = callbackData.message || callbackData.failureReason;
      financialTransactionId = callbackData.transactionId;
    } else {
      // Extract MTN MOMO callback data
      referenceId = callbackData.referenceId;
      providerStatus = callbackData.status;
      reason = callbackData.reason;
      financialTransactionId = callbackData.financialTransactionId;
    }

    if (!referenceId) {
      console.error('[CALLBACK] No reference ID in callback');
      return NextResponse.json(
        { error: 'Missing reference ID' },
        { status: 400 }
      );
    }

    // Get existing payment
    let payment = await paymentService.getPaymentByTransactionId(referenceId);
    
    // If not found by transaction ID, try to find by payment ID
    if (!payment && referenceId) {
      try {
        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("id", referenceId)
          .single();
        if (data) payment = data as any;
      } catch (e) {
        console.log("Payment not found by ID:", referenceId);
      }
    }
    
    if (!payment) {
      console.error('[CALLBACK] Payment not found:', referenceId);
      // Return 200 to acknowledge receipt (prevents provider from retrying)
      return NextResponse.json(
        { message: 'Callback received, payment not found' },
        { status: 200 }
      );
    }

    // Map provider status to our payment status
    const mappedStatus = provider === 'orange' 
      ? mapOrangeMoneyStatus(providerStatus)
      : mapMtnMomoStatus(providerStatus);

    // Update payment status via orchestration service
    await orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
      transaction_id: financialTransactionId || referenceId,
      provider_response: callbackData,
      error_message: reason || undefined,
    });

    console.log(`[CALLBACK] ${provider.toUpperCase()} callback processed successfully`);

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('[CALLBACK] Error processing payment callback:', error);
    // Return 200 to prevent provider retries on our errors
    return NextResponse.json(
      { message: 'Callback received' },
      { status: 200 }
    );
  }
}
