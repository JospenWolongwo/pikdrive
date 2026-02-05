import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerPaymentService, ServerPaymentOrchestrationService } from '@/lib/services/server/payment';
import { MTNMomoService } from '@/lib/payment/mtn-momo-service';
import { PawaPayService } from '@/lib/payment/pawapay/pawapay-service';
import { mapMtnMomoStatus, mapPawaPayStatus } from '@/lib/payment/status-mapper';
import { parseFailureReason } from '@/lib/payment/failure-reason-parser';
import type { Environment } from '@/types/payment-ext';
import { Environment as EnvEnum, PawaPayApiUrl } from '@/types/payment-ext';

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

    // Determine which provider API to use for status check
    // Priority: 1) USE_PAWAPAY env var, 2) payment.provider from database, 3) request parameter
    const usePawaPay = process.env.USE_PAWAPAY === 'true';
    const actualProvider = usePawaPay ? 'pawapay' : (payment.provider || provider);
    
    console.log('🔍 [CHECK-STATUS] Provider determination:', {
      usePawaPay,
      paymentProvider: payment.provider,
      requestProvider: provider,
      actualProvider,
      note: usePawaPay ? 'pawaPay enabled - using pawaPay API' : 'Using provider from payment record or request',
    });

    // Check status with provider
    let newStatus = payment.status;
    let userFriendlyErrorMessage: string | undefined = undefined;
    
    if (actualProvider === 'pawapay') {
      console.log('🔄 [CHECK-STATUS] Querying pawaPay API for status...');
      
      try {
        const pawapayService = new PawaPayService({
          apiToken: process.env.PAWAPAY_API_TOKEN || "",
          baseUrl: process.env.PAWAPAY_BASE_URL || (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION ? PawaPayApiUrl.PRODUCTION : PawaPayApiUrl.SANDBOX),
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/pawapay`,
          environment: (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment,
        });

        // Use checkPayment with transaction_id (which is the depositId)
        const checkResult = await pawapayService.checkPayment(transactionId);
        
        if (!checkResult.response.success) {
          console.error('❌ [CHECK-STATUS] Failed to check payment status:', checkResult.response.message);
          throw new Error(checkResult.response.message);
        }

        // Extract status from pawaPay response
        const transactionStatus = checkResult.response.transactionStatus;
        const statusString = transactionStatus || 'UNKNOWN';

        console.log('📊 [CHECK-STATUS] pawaPay Status:', {
          status: statusString,
          transactionStatus,
          apiResponse: checkResult.response.apiResponse,
        });

        // Extract failure reason if payment failed
        const failureReason = checkResult.response.apiResponse?.data?.failureReason;
        const customerMessage = checkResult.response.apiResponse?.data?.customerMessage;
        
        if (failureReason) {
          console.log('❌ [CHECK-STATUS] Payment failed - Reason:', {
            failureReason: typeof failureReason === 'object' ? JSON.stringify(failureReason) : failureReason,
            customerMessage,
            depositId: checkResult.response.apiResponse?.data?.depositId,
          });
        }

        // Map pawaPay status to our payment status
        // pawaPay API returns status nested in data.status, fallback to root status
        const pawapayStatus = checkResult.response.apiResponse?.data?.status 
          || checkResult.response.apiResponse?.status 
          || statusString;
        newStatus = mapPawaPayStatus(pawapayStatus);
        
        // Parse failure reason to user-friendly message if payment failed
        if (newStatus === 'failed' && failureReason) {
          userFriendlyErrorMessage = parseFailureReason(failureReason);
        }
        
        console.log('🔄 [CHECK-STATUS] Status mapping:', { 
          pawapayStatus: pawapayStatus, 
          ourStatus: newStatus,
          failureReason: failureReason ? (typeof failureReason === 'object' ? JSON.stringify(failureReason) : failureReason) : undefined,
          userFriendlyMessage: userFriendlyErrorMessage,
        });

        // Update payment if status changed
        if (newStatus !== payment.status) {
          console.log('🔄 [CHECK-STATUS] Status changed, orchestrating update:', {
            oldStatus: payment.status,
            newStatus,
          });
          
          console.log('🔔 [CHECK-STATUS] Triggering orchestration service for status change');
          
          // Format failure reason as error message for failed payments
          const errorMessage = newStatus === 'failed' && failureReason
            ? (typeof failureReason === 'object' ? JSON.stringify(failureReason) : String(failureReason)) + (customerMessage ? ` (${customerMessage})` : '')
            : undefined;
          
          await orchestrationService.handlePaymentStatusChange(payment, newStatus, {
            transaction_id: transactionId,
            provider_response: checkResult.response.apiResponse,
            error_message: errorMessage,
          });
          
          console.log('🔔 [CHECK-STATUS] Orchestration completed, notifications should be sent');
          console.log('✅ [CHECK-STATUS] Payment status updated successfully');
        } else {
          console.log('ℹ️ [CHECK-STATUS] Status unchanged, no update needed');
        }
      } catch (providerError) {
        console.error('❌ [CHECK-STATUS] pawaPay API error:', providerError);
        
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
    } else if (actualProvider === 'mtn') {
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

        // Use checkPayment with transaction_id (which is the xReferenceId/payToken)
        const checkResult = await mtnService.checkPayment(transactionId);
        
        if (!checkResult.response.success) {
          console.error('❌ [CHECK-STATUS] Failed to check payment status:', checkResult.response.message);
          throw new Error(checkResult.response.message);
        }

        // Extract status from the checkPayment response
        const transactionStatus = checkResult.response.transactionStatus;
        const statusString = transactionStatus === 'SUCCESS' ? 'SUCCESSFUL' 
          : transactionStatus === 'PENDING' ? 'PENDING'
          : transactionStatus === 'FAILED' ? 'FAILED'
          : 'UNKNOWN';

        console.log('📊 [CHECK-STATUS] MTN MOMO Status:', {
          status: statusString,
          transactionStatus,
          apiResponse: checkResult.response.apiResponse,
        });

        // Map MTN status to our payment status using enum-based mapper
        newStatus = mapMtnMomoStatus(statusString);
        console.log('🔄 [CHECK-STATUS] Status mapping:', { 
          mtmStatus: statusString, 
          ourStatus: newStatus,
        });

        // Update payment if status changed
        if (newStatus !== payment.status) {
          console.log('🔄 [CHECK-STATUS] Status changed, orchestrating update:', {
            oldStatus: payment.status,
            newStatus,
          });
          
          console.log('🔔 [CHECK-STATUS] Triggering orchestration service for status change');
          await orchestrationService.handlePaymentStatusChange(payment, newStatus, {
            transaction_id: transactionId,
            provider_response: checkResult.response.apiResponse,
          });
          
          console.log('🔔 [CHECK-STATUS] Orchestration completed, notifications should be sent');
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
    } else if (actualProvider === 'orange') {
      // Orange Money status check (if implemented)
      console.log('⚠️ [CHECK-STATUS] Orange Money status check not yet implemented');
      console.log('ℹ️ [CHECK-STATUS] Returning current database status');
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

    // Use user-friendly error message if available, otherwise use generic status message
    const responseMessage = userFriendlyErrorMessage || getStatusMessage(newStatus);

    return NextResponse.json({
      success: true,
      data: {
        status: newStatus,
        message: responseMessage,
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
