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
    console.log('📥 Received MTN MOMO callback:', callbackData);

    // Extract key information
    const {
      referenceId,  // Our transactionId
      status,       // SUCCESSFUL, FAILED, PENDING, etc.
      reason,       // Error reason if failed
      financialTransactionId, // MTN's transaction ID for successful payments
    } = callbackData;

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
      'mtn',
      {
        status,
        reason,
        transactionId: referenceId,
        financialTransactionId
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Callback error:', error);
    return NextResponse.json(
      { error: 'Callback processing failed' },
      { status: 500 }
    );
  }
}
