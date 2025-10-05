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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { transactionId, provider } = body;

    if (!transactionId || !provider) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: transactionId, provider' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking payment status:', { transactionId, provider, userId: user.id });

    // Get payment record
    const payment = await paymentService.getPaymentByTransactionId(transactionId);
    
    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found', status: 'failed' },
        { status: 404 }
      );
    }

    // If payment is already finalized, return current status
    if (paymentService.isPaymentFinalized(payment)) {
      console.log('✅ Payment already finalized:', payment.status);
      return NextResponse.json({
        success: true,
        data: {
          status: payment.status,
          message: getStatusMessage(payment.status),
        },
      });
    }

    // Check status with provider
    let newStatus = payment.status;
    
    if (provider === 'mtn') {
      const mtnService = new MTNMomoService({
        subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY!,
        apiKey: process.env.MOMO_API_KEY!,
        targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
        callbackHost: process.env.MOMO_CALLBACK_HOST!,
        collectionPrimaryKey: process.env.MOMO_COLLECTION_PRIMARY_KEY!,
        collectionUserId: process.env.MOMO_COLLECTION_USER_ID!,
      });

      const momoStatus = await mtnService.getPaymentStatus(transactionId);
      console.log('📊 MTN MOMO Status:', momoStatus);

      // Map MTN status to our payment status
      switch (momoStatus.status) {
        case 'SUCCESSFUL':
          newStatus = 'completed';
          break;
        case 'FAILED':
          newStatus = 'failed';
          break;
        case 'PENDING':
          newStatus = 'processing';
          break;
        default:
          newStatus = 'pending';
      }

      // Update payment if status changed
      if (newStatus !== payment.status) {
        await orchestrationService.handlePaymentStatusChange(payment, newStatus, {
          transaction_id: momoStatus.financialTransactionId,
          provider_response: momoStatus,
        });
      }
    } else {
      // For other providers, return current status
      console.log('⚠️ Status check not implemented for provider:', provider);
    }

    console.log('✅ Payment status checked:', newStatus);

    return NextResponse.json({
      success: true,
      data: {
        status: newStatus,
        message: getStatusMessage(newStatus),
      },
    });
  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check payment status',
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
