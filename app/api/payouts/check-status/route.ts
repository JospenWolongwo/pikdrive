import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { MTNMomoService } from '@/lib/payment/mtn-momo-service';
import { mapMtnPayoutStatus, shouldRetry } from '@/lib/payment/retry-logic';
import { mapMtnMomoStatus } from '@/lib/payment/status-mapper';
import { sendPayoutNotificationIfNeeded } from '@/lib/payment/payout-notification-helper';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

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
    const { transactionId, payoutId } = body;

    if (!transactionId && !payoutId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: transactionId or payoutId required' },
        { status: 400 }
      );
    }

    console.log('🔍 [PAYOUT-STATUS] Starting payout status check:', { 
      transactionId, 
      payoutId,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    // Find payout record
    let payout: any = null;
    
    if (payoutId) {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('id', payoutId)
        .single();
      
      if (error) {
        console.error('❌ [PAYOUT-STATUS] Error fetching payout by ID:', error);
      } else {
        payout = data;
      }
    }
    
    if (!payout && transactionId) {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();
      
      if (error) {
        console.error('❌ [PAYOUT-STATUS] Error fetching payout by transaction_id:', error);
      } else {
        payout = data;
      }
    }

    if (!payout) {
      console.error('❌ [PAYOUT-STATUS] Payout not found');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Payout not found',
          status: 'failed',
        },
        { status: 404 }
      );
    }

    // Verify user owns this payout (if not admin)
    if (payout.driver_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - payout does not belong to user' },
        { status: 403 }
      );
    }

    // If payout is already finalized, return current status
    if (payout.status === 'completed' || payout.status === 'failed') {
      console.log('✅ [PAYOUT-STATUS] Payout already finalized:', payout.status);
      return NextResponse.json({
        success: true,
        data: {
          status: payout.status,
          message: getStatusMessage(payout.status),
          payoutId: payout.id,
          transactionId: payout.transaction_id,
          updated: false,
        },
      });
    }

    // Check status with provider
    let newStatus = payout.status;
    let statusUpdated = false;
    let retryable = false;
    
    if (payout.provider === 'mtn' && payout.transaction_id) {
      console.log('🔄 [PAYOUT-STATUS] Querying MTN API for payout status...');
      
      try {
        const mtnService = new MTNMomoService({
          subscriptionKey: process.env.DIRECT_MOMO_APIM_SUBSCRIPTION_KEY || process.env.MOMO_SUBSCRIPTION_KEY || '',
          apiKey: process.env.DIRECT_MOMO_API_KEY || process.env.MOMO_API_KEY || '',
          targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
          callbackHost: process.env.MOMO_CALLBACK_HOST || process.env.NEXT_PUBLIC_APP_URL || '',
          collectionPrimaryKey: process.env.DIRECT_MOMO_COLLECTION_PRIMARY_KEY || process.env.MOMO_COLLECTION_PRIMARY_KEY || '',
          collectionUserId: process.env.DIRECT_MOMO_COLLECTION_USER_ID || process.env.MOMO_COLLECTION_USER_ID || '',
          disbursementApiUser: process.env.DIRECT_MOMO_API_USER_DISBURSMENT || process.env.MOMO_DISBURSEMENT_API_USER,
          disbursementApiKey: process.env.DIRECT_MOMO_API_KEY_DISBURSMENT || process.env.MOMO_DISBURSEMENT_API_KEY,
          disbursementSubscriptionKey: process.env.DIRECT_MOMO_APIM_PAY_OUT_SUBSCRIPTION_KEY || process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
        });

        // Check payout status using transaction_id (xReferenceId)
        const statusResult = await mtnService.checkPayoutStatus(payout.transaction_id);
        
        if (!statusResult) {
          console.error('❌ [PAYOUT-STATUS] Failed to check payout status - no result returned');
          throw new Error('Failed to check payout status');
        }

        const mtnStatus = statusResult.status;
        const reason = statusResult.reason;

        console.log('📊 [PAYOUT-STATUS] MTN payout status:', {
          status: mtnStatus,
          reason,
          amount: statusResult.amount,
          currency: statusResult.currency,
          financialTransactionId: statusResult.financialTransactionId,
        });

        // Map MTN status to our internal status
        newStatus = mapMtnPayoutStatus(mtnStatus);
        
        // Determine if retryable
        retryable = shouldRetry(mtnStatus, reason);

        console.log('🔄 [PAYOUT-STATUS] Status mapping:', { 
          mtnStatus, 
          ourStatus: newStatus,
          retryable,
        });

        // Update payout if status changed
        if (newStatus !== payout.status) {
          console.log('🔄 [PAYOUT-STATUS] Status changed, updating payout:', {
            oldStatus: payout.status,
            newStatus,
          });
          
          const { error: updateError } = await supabase
            .from('payouts')
            .update({
              status: newStatus,
              transaction_id: statusResult.financialTransactionId || payout.transaction_id,
              metadata: {
                ...(payout.metadata || {}),
                lastStatusCheck: new Date().toISOString(),
                mtnStatus: mtnStatus,
                mtnReason: reason,
                statusCheckedAt: new Date().toISOString(),
              },
            })
            .eq('id', payout.id);

          if (updateError) {
            console.error('❌ [PAYOUT-STATUS] Error updating payout status:', updateError);
          } else {
            statusUpdated = true;
            console.log('✅ [PAYOUT-STATUS] Payout status updated successfully');

            // Send notification if status changed to completed or failed (with deduplication)
            if (newStatus === 'completed' && payout.driver_id) {
              await sendPayoutNotificationIfNeeded(
                supabase,
                { ...payout, status: newStatus },
                'completed',
                undefined,
                'status-check'
              );
            } else if (newStatus === 'failed' && payout.driver_id) {
              await sendPayoutNotificationIfNeeded(
                supabase,
                { ...payout, status: newStatus },
                'failed',
                reason || mtnStatus || 'Transaction échouée',
                'status-check'
              );
            }
          }
        } else {
          console.log('ℹ️ [PAYOUT-STATUS] Status unchanged, no update needed');
        }
      } catch (providerError) {
        console.error('❌ [PAYOUT-STATUS] MTN API error:', providerError);
        
        // Don't fail the entire request if provider check fails
        // Return current status from database
        return NextResponse.json({
          success: true,
          data: {
            status: payout.status,
            message: getStatusMessage(payout.status),
            payoutId: payout.id,
            transactionId: payout.transaction_id,
            updated: false,
            warning: 'Unable to check with provider, returning cached status',
          },
        });
      }
    } else {
      // For other providers or missing transaction_id, return current status
      console.log('⚠️ [PAYOUT-STATUS] Status check not implemented for provider:', payout.provider);
      console.log('ℹ️ [PAYOUT-STATUS] Returning current database status');
    }

    console.log('✅ [PAYOUT-STATUS] Payout status check completed:', {
      finalStatus: newStatus,
      payoutId: payout.id,
      transactionId: payout.transaction_id,
      updated: statusUpdated,
      retryable,
    });

    return NextResponse.json({
      success: true,
      data: {
        status: newStatus,
        message: getStatusMessage(newStatus),
        payoutId: payout.id,
        transactionId: payout.transaction_id,
        updated: statusUpdated,
        shouldRetry: retryable,
      },
    });
  } catch (error) {
    console.error('❌ [PAYOUT-STATUS] Critical error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check payout status',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 }
    );
  }
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    pending: 'Payout is pending',
    processing: 'Payout is being processed',
    completed: 'Payout completed successfully!',
    failed: 'Payout failed. Please contact support.',
  };
  
  return messages[status] || 'Unknown payout status';
}

