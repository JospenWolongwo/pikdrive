import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const paymentService = new PaymentService(supabase);

    // Get callback data
    const callbackData = await request.json();
    
    // Determine provider from request URL
    const url = new URL(request.url);
    const provider = url.pathname.includes('orange') ? 'orange' : 'mtn';
    
    console.log(`📥 Received ${provider.toUpperCase()} callback:`, callbackData);

    let referenceId, status, reason, financialTransactionId;

    if (provider === 'orange') {
      // Extract Orange Money callback data
      referenceId = callbackData.externalId || callbackData.transactionId;
      status = callbackData.status === 'SUCCESSFUL' ? 'SUCCESSFUL' : 'FAILED';
      reason = callbackData.message || callbackData.failureReason;
      financialTransactionId = callbackData.transactionId;
    } else {
      // Extract MTN MOMO callback data
      referenceId = callbackData.referenceId;
      status = callbackData.status;
      reason = callbackData.reason;
      financialTransactionId = callbackData.financialTransactionId;
    }

    if (!referenceId) {
      console.error('❌ No reference ID in callback');
      return NextResponse.json(
        { error: 'Missing reference ID' },
        { status: 400 }
      );
    }

    // Get existing payment
    const payment = await paymentService.getPaymentByTransactionId(referenceId);
    if (!payment) {
      console.error('❌ Payment not found:', referenceId);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Handle callback
    await paymentService.handlePaymentCallback(
      provider,
      {
        status,
        reason,
        transactionId: referenceId,
        financialTransactionId
      }
    );

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('❌ Error processing payment callback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
