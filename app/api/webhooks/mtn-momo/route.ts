import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';
import { mapMtnMomoStatus } from '@/lib/payment/status-mapper';
import crypto from 'crypto';

// Verify MTN MOMO webhook signature
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.MOMO_WEBHOOK_SECRET!;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const paymentService = new ServerPaymentService(supabase);
    const orchestrationService = new ServerPaymentOrchestrationService(supabase);

    // Get signature from headers
    const signature = request.headers.get('x-signature');
    if (!signature) {
      console.error('❌ No signature provided');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Get and verify payload
    const payload = await request.text();
    if (!verifySignature(payload, signature)) {
      console.error('❌ Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook data
    const webhookData = JSON.parse(payload);
    console.log('📥 Received webhook:', webhookData);

    // Get transaction ID from reference
    const transactionId = request.headers.get('x-reference');
    if (!transactionId) {
      console.error('❌ No transaction ID provided');
      return NextResponse.json(
        { error: 'Missing transaction ID' },
        { status: 400 }
      );
    }

    // Get existing payment
    let payment = await paymentService.getPaymentByTransactionId(transactionId);
    
    // If not found, try by ID
    if (!payment && transactionId) {
      try {
        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("id", transactionId)
          .single();
        if (data) payment = data as any;
      } catch (e) {
        console.log("Payment not found by ID:", transactionId);
      }
    }
    
    if (!payment) {
      console.error('❌ Payment not found:', transactionId);
      // Return 200 to acknowledge receipt (prevents retries)
      return NextResponse.json(
        { message: 'Callback received, payment not found' },
        { status: 200 }
      );
    }

    // Determine status and map to internal status
    let mappedStatus;
    let metadata: any = {};

    switch (webhookData.type) {
      case 'payment.success':
        mappedStatus = mapMtnMomoStatus('SUCCESSFUL');
        metadata.transaction_id = webhookData.data.financialTransactionId;
        break;

      case 'payment.failed':
        mappedStatus = mapMtnMomoStatus('FAILED');
        metadata.error_message = webhookData.data.reason;
        break;

      default:
        console.warn('⚠️ Unknown webhook type:', webhookData.type);
        return NextResponse.json(
          { error: 'Unknown webhook type' },
          { status: 400 }
        );
    }

    // Update payment status via orchestration service
    await orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
      ...metadata,
      provider_response: webhookData,
    });

    console.log('✅ Webhook processed successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Return 200 to prevent retries on our errors
    return NextResponse.json(
      { message: 'Webhook received' },
      { status: 200 }
    );
  }
}
