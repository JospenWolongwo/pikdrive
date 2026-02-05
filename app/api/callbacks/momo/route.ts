import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ServerPaymentService, ServerPaymentOrchestrationService } from '@/lib/services/server/payment';
import { mapMtnMomoStatus } from '@/lib/payment/status-mapper';

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

    // Get the signature from headers
    const signature = request.headers.get('x-mtn-signature');
    console.log('🔐 MTN signature:', signature);
    
    // Get the callback payload
    const callback = await request.json();
    console.log('📦 MTN callback payload:', callback);

    // Extract transaction details from MOMO callback
    const {
      financialTransactionId,
      externalId,
      amount,
      currency,
      payer,
      payerMessage,
      status,
      reason,
    } = callback;

    if (!externalId) {
      console.error("❌ No externalId in MOMO callback");
      return NextResponse.json(
        { error: "Missing externalId" },
        { status: 400 }
      );
    }

    // Find payment by transaction ID (externalId is the payment ID or booking ID)
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
      console.error("❌ Payment not found for externalId:", externalId);
      // Return 200 to acknowledge receipt even if payment not found
      // (prevents MOMO from retrying)
      return NextResponse.json(
        { message: "Callback received, payment not found" },
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

    console.log('✅ MTN callback processed successfully');

    return NextResponse.json({ message: "Callback received" }, { status: 200 });
  } catch (error) {
    console.error('❌ MTN MOMO callback error:', error);
    // Return 200 to prevent retries on our errors
    return NextResponse.json(
      { message: 'Callback received' },
      { status: 200 }
    );
  }
}
