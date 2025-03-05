import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// This endpoint should be called by a cron job every 5 minutes
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const paymentService = new PaymentService(supabase);

    // Get all pending payments older than 5 minutes
    const { data: pendingPayments, error } = await supabase
      .from('payments')
      .select('*')
      .is('payment_time', null)
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (error) {
      console.error('❌ Error fetching pending payments:', error);
      throw error;
    }

    console.log('🔍 Found stale pending payments:', pendingPayments?.length || 0);

    // Check status for each pending payment
    const results = await Promise.all(
      (pendingPayments || []).map(async (payment) => {
        try {
          const status = await paymentService.checkPaymentStatus(
            payment.transaction_id,
            payment.provider
          );

          console.log('📊 Payment status update:', {
            paymentId: payment.id,
            transactionId: payment.transaction_id,
            status: status.status
          });

          return {
            paymentId: payment.id,
            status: status.status,
            error: null
          };
        } catch (error) {
          console.error('❌ Error checking payment:', {
            paymentId: payment.id,
            error
          });

          return {
            paymentId: payment.id,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    return NextResponse.json({
      checked: results.length,
      results
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to process pending payments' },
      { status: 500 }
    );
  }
}
