import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ServerPaymentService, ServerPaymentOrchestrationService } from '@/lib/services/server/payment';
import { PaymentReconciliationService } from '@/lib/services/payment-reconciliation.service';
import { PayoutReconciliationService } from '@/lib/services/payout-reconciliation.service';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// This endpoint should be called by a cron job every 5 minutes
export async function GET(request: Request) {
  try {
    // Initialize Supabase with service role for cron job
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
    const paymentReconciliationService = new PaymentReconciliationService(orchestrationService);
    const payoutReconciliationService = new PayoutReconciliationService(supabase);

    // Get all pending/processing payments older than 5 minutes
    const { data: stalePayments, error } = await supabase
      .from('payments')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (error) {
      console.error('❌ Error fetching stale payments:', error);
      throw error;
    }

    console.log('🔍 Found stale payments:', stalePayments?.length || 0);

    // Get all pending/processing payouts older than 5 minutes
    const { data: stalePayouts, error: payoutError } = await supabase
      .from('payouts')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (payoutError) {
      console.error('❌ Error fetching stale payouts:', payoutError);
    }

    console.log('🔍 Found stale payouts:', stalePayouts?.length || 0);

    // Reconcile payments (MTN, Orange Money, pawaPay)
    const paymentResults = await paymentReconciliationService.reconcilePayments(
      stalePayments || []
    );

    // Reconcile payouts (MTN, Orange Money, pawaPay)
    const payoutResults = await payoutReconciliationService.reconcilePayouts(
      stalePayouts || []
    );

    return NextResponse.json({
      payments: {
        checked: paymentResults.length,
        results: paymentResults
      },
      payouts: {
        checked: payoutResults.length,
        results: payoutResults
      }
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to process stale payments' },
      { status: 500 }
    );
  }
}
