import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';
import { MTNMomoService } from '@/lib/payment/mtn-momo-service';
import { mapMtnMomoStatus } from '@/lib/payment/status-mapper';

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

    // Check status for each stale payment
    const results = await Promise.all(
      (stalePayments || []).map(async (payment) => {
        try {
          // Only check MTN for now (add Orange if needed)
          if (payment.provider === 'mtn' && payment.transaction_id) {
            const mtnService = new MTNMomoService({
              subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY!,
              apiKey: process.env.MOMO_API_KEY!,
              targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
              callbackHost: process.env.MOMO_CALLBACK_HOST!,
              collectionPrimaryKey: process.env.MOMO_COLLECTION_PRIMARY_KEY!,
              collectionUserId: process.env.MOMO_COLLECTION_USER_ID!,
            });

            // Use checkPayment with transaction_id (which is the xReferenceId/payToken)
            const checkResult = await mtnService.checkPayment(payment.transaction_id);

            if (!checkResult.response.success) {
              console.error('❌ Failed to check payment status:', checkResult.response.message);
              throw new Error(checkResult.response.message);
            }

            // Extract status from the checkPayment response
            const transactionStatus = checkResult.response.transactionStatus;
            const statusString = transactionStatus === 'SUCCESS' ? 'SUCCESSFUL' 
              : transactionStatus === 'PENDING' ? 'PENDING'
              : transactionStatus === 'FAILED' ? 'FAILED'
              : 'UNKNOWN';

            const mappedStatus = mapMtnMomoStatus(statusString);

            // Update if status changed
            if (mappedStatus !== payment.status) {
              await orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
                transaction_id: payment.transaction_id,
                provider_response: checkResult.response.apiResponse,
              });
            }

            console.log('📊 Payment status updated:', {
              paymentId: payment.id,
              transactionId: payment.transaction_id,
              oldStatus: payment.status,
              newStatus: mappedStatus
            });

            return {
              paymentId: payment.id,
              oldStatus: payment.status,
              newStatus: mappedStatus,
              error: null
            };
          }

          return {
            paymentId: payment.id,
            oldStatus: payment.status,
            newStatus: payment.status,
            error: null
          };
        } catch (error) {
          console.error('❌ Error checking payment:', {
            paymentId: payment.id,
            error
          });

          return {
            paymentId: payment.id,
            oldStatus: payment.status,
            newStatus: payment.status,
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
      { error: 'Failed to process stale payments' },
      { status: 500 }
    );
  }
}
