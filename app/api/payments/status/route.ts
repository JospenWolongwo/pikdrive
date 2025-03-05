import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const paymentService = new PaymentService(supabase);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');
    const provider = searchParams.get('provider');

    if (!transactionId || !provider) {
      return NextResponse.json(
        { error: 'Missing transactionId or provider' },
        { status: 400 }
      );
    }

    // Check payment status
    const status = await paymentService.checkPaymentStatus(transactionId, provider);
    console.log(' 🔍 Payment status check:', { transactionId, status });

    // If payment is successful, trigger receipt generation
    if (status.status === 'completed') {
      const payment = await paymentService.getPaymentByTransactionId(transactionId);
      if (payment) {
        console.log(' 📄 Generating receipt for payment:', payment.id);
        // Receipt will be created by the trigger we set up
      }
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error(' ❌ Payment status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
