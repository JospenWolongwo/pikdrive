import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';
import { mapOrangeMoneyStatus } from '@/lib/payment/status-mapper';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // Initialize Supabase inside the handler (service role key for edge runtime)
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

    // Get callback data first
    const callbackData = await request.json();
    console.log('🟡 Orange Money callback received:', callbackData);

    // Extract key information
    const {
      status,
      transactionId,
      externalId,
      message,
      failureReason
    } = callbackData;

    if (!externalId && !transactionId) {
      console.error('❌ No payment reference in callback');
      return NextResponse.json(
        { error: 'Missing payment reference' },
        { status: 400 }
      );
    }

    // Find payment by transaction ID or ID
    let payment = await paymentService.getPaymentByTransactionId(externalId || transactionId);
    
    // If not found, try by ID
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
      console.error('❌ Payment not found:', { externalId, transactionId });
      // Return 200 to acknowledge receipt (prevents retries)
      return NextResponse.json(
        { message: 'Callback received, payment not found' },
        { status: 200 }
      );
    }

    // Map Orange Money status to our payment status
    const mappedStatus = mapOrangeMoneyStatus(status);

    // Update payment status via orchestration service
    await orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
      transaction_id: transactionId,
      provider_response: callbackData,
      error_message: failureReason || message,
    });

    console.log('✅ Orange Money callback processed successfully');

    return NextResponse.json({ 
      status: 'success',
      message: 'Payment callback processed successfully'
    });
  } catch (error) {
    console.error('❌ Error processing Orange Money callback:', error);
    // Return 200 to prevent retries on our errors
    return NextResponse.json(
      { message: 'Callback received' },
      { status: 200 }
    );
  }
}
