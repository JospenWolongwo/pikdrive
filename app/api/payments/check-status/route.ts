import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';
import { MTNMomoService } from '@/lib/payment/mtn-momo-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const paymentService = new ServerPaymentService(supabase);
    const orchestrationService = new ServerPaymentOrchestrationService(supabase);

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const user = session.user;

    // Get request body
    const body = await request.json();
    const { transactionId, provider, bookingId } = body;

    if (!transactionId || !provider) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: transactionId, provider' },
        { status: 400 }
      );
    }

    console.log('🔍 [CHECK-STATUS] Starting payment status check:', { 
      transactionId, 
      provider, 
      bookingId,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    // RESILIENT QUERY STRATEGY: Use multiple fallback strategies
    const payment = await paymentService.getPaymentWithFallbacks({
      transactionId,
      bookingId,
    });
    
    console.log('🔍 [CHECK-STATUS] Payment search result:', 
      payment ? { 
        id: payment.id, 
        transaction_id: payment.transaction_id, 
        status: payment.status,
        booking_id: payment.booking_id,
        amount: payment.amount 
      } : 'null'
    );
    
    if (!payment) {
      // Enhanced error response with debugging info
      console.error('❌ [CHECK-STATUS] Payment not found with any strategy');
      
      // Debug: Show recent payments for troubleshooting
      const { data: recentPayments } = await supabase
        .from('payments')
        .select('id, transaction_id, status, booking_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('🔍 [CHECK-STATUS] Recent payments in database:', recentPayments);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment not found', 
          status: 'failed',
          debug: {
            searchCriteria: { transactionId, bookingId },
            recentPaymentsCount: recentPayments?.length || 0,
            hint: 'Payment might not exist or transaction_id not yet saved'
          }
        },
        { status: 404 }
      );
    }

    // If payment is already finalized, return current status
    if (paymentService.isPaymentFinalized(payment)) {
      console.log('✅ [CHECK-STATUS] Payment already finalized:', payment.status);
      return NextResponse.json({
        success: true,
        data: {
          status: payment.status,
          message: getStatusMessage(payment.status),
          paymentId: payment.id,
          transactionId: payment.transaction_id,
        },
      });
    }

    // Check status with provider
    let newStatus = payment.status;
    
    if (provider === 'mtn') {
      console.log('🔄 [CHECK-STATUS] Querying MTN MoMo API for status...');
      
      try {
        const mtnService = new MTNMomoService({
          subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY!,
          apiKey: process.env.MOMO_API_KEY!,
          targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
          callbackHost: process.env.MOMO_CALLBACK_HOST!,
          collectionPrimaryKey: process.env.MOMO_COLLECTION_PRIMARY_KEY!,
          collectionUserId: process.env.MOMO_COLLECTION_USER_ID!,
        });

        const momoStatus = await mtnService.getPaymentStatus(transactionId);
        console.log('📊 [CHECK-STATUS] MTN MOMO Status:', {
          status: momoStatus.status,
          financialTransactionId: momoStatus.financialTransactionId,
          reason: momoStatus.reason,
        });

        // Map MTN status to our payment status
        const statusMapping: Record<string, any> = {
          'SUCCESSFUL': 'completed',
          'FAILED': 'failed',
          'PENDING': 'processing',
        };
        
        newStatus = statusMapping[momoStatus.status] || 'pending';
        console.log('🔄 [CHECK-STATUS] Status mapping:', { 
          momoStatus: momoStatus.status, 
          ourStatus: newStatus 
        });

        // Update payment if status changed
        if (newStatus !== payment.status) {
          console.log('🔄 [CHECK-STATUS] Status changed, orchestrating update:', {
            oldStatus: payment.status,
            newStatus,
          });
          
          await orchestrationService.handlePaymentStatusChange(payment, newStatus, {
            transaction_id: momoStatus.financialTransactionId,
            provider_response: momoStatus,
          });
          
          console.log('✅ [CHECK-STATUS] Payment status updated successfully');
        } else {
          console.log('ℹ️ [CHECK-STATUS] Status unchanged, no update needed');
        }
      } catch (providerError) {
        console.error('❌ [CHECK-STATUS] MTN MOMO API error:', providerError);
        
        // Don't fail the entire request if provider check fails
        // Return current status from database
        return NextResponse.json({
          success: true,
          data: {
            status: payment.status,
            message: getStatusMessage(payment.status),
            paymentId: payment.id,
            transactionId: payment.transaction_id,
            warning: 'Unable to check with provider, returning cached status',
          },
        });
      }
    } else {
      // For other providers, return current status
      console.log('⚠️ [CHECK-STATUS] Status check not implemented for provider:', provider);
      console.log('ℹ️ [CHECK-STATUS] Returning current database status');
    }

    console.log('✅ [CHECK-STATUS] Payment status check completed:', {
      finalStatus: newStatus,
      paymentId: payment.id,
      transactionId: payment.transaction_id,
    });

    return NextResponse.json({
      success: true,
      data: {
        status: newStatus,
        message: getStatusMessage(newStatus),
        paymentId: payment.id,
        transactionId: payment.transaction_id,
      },
    });
  } catch (error) {
    console.error('❌ [CHECK-STATUS] Critical error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check payment status',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 }
    );
  }
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    pending: 'Payment is pending approval',
    processing: 'Payment is being processed',
    completed: 'Payment completed successfully! Your seats have been reserved.',
    failed: 'Payment failed. Please try again.',
    cancelled: 'Payment was cancelled',
    refunded: 'Payment has been refunded',
  };
  
  return messages[status] || 'Unknown payment status';
}
