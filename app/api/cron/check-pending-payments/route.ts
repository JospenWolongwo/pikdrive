import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';
import { MTNMomoService } from '@/lib/payment/mtn-momo-service';
import { PawaPayService } from '@/lib/payment/pawapay/pawapay-service';
import { PayoutOrchestratorService } from '@/lib/payment/payout-orchestrator.service';
import { mapMtnMomoStatus, mapPawaPayStatus } from '@/lib/payment/status-mapper';
import { mapMtnPayoutStatus, shouldRetry } from '@/lib/payment/retry-logic';
import { sendPayoutNotificationIfNeeded } from '@/lib/payment/payout-notification-helper';
import type { Environment } from '@/types/payment-ext';
import { Environment as EnvEnum, PawaPayApiUrl } from '@/types/payment-ext';

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

    // Check status for each stale payment
    const paymentResults = await Promise.all(
      (stalePayments || []).map(async (payment) => {
        try {
          // Check MTN payments
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

          // Check pawaPay payments
          if (payment.provider === 'pawapay' && payment.transaction_id) {
            const pawapayService = new PawaPayService({
              apiToken: process.env.PAWAPAY_API_TOKEN || "",
              baseUrl: process.env.PAWAPAY_BASE_URL || (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION ? PawaPayApiUrl.PRODUCTION : PawaPayApiUrl.SANDBOX),
              callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/pawapay`,
              environment: (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment,
            });

            // Use checkPayment with transaction_id (which is the depositId)
            const checkResult = await pawapayService.checkPayment(payment.transaction_id);

            if (!checkResult.response.success) {
              console.error('❌ Failed to check pawaPay payment status:', checkResult.response.message);
              throw new Error(checkResult.response.message);
            }

            // Extract status from pawaPay response
            const pawapayStatus = checkResult.response.apiResponse?.status || checkResult.response.transactionStatus || 'UNKNOWN';
            const mappedStatus = mapPawaPayStatus(pawapayStatus);

            // Update if status changed
            if (mappedStatus !== payment.status) {
              await orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
                transaction_id: payment.transaction_id,
                provider_response: checkResult.response.apiResponse,
              });
            }

            console.log('📊 pawaPay payment status updated:', {
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

    // Check status for each stale payout
    const payoutResults = await Promise.all(
      (stalePayouts || []).map(async (payout) => {
        try {
          // Check MTN payouts
          if (payout.provider === 'mtn' && payout.transaction_id) {
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

            // Use checkPayoutStatus with transaction_id (which is the xReferenceId)
            const statusResult = await mtnService.checkPayoutStatus(payout.transaction_id);

            if (!statusResult) {
              console.error('❌ Failed to check payout status - no result returned');
              throw new Error('Failed to check payout status');
            }

            const mtnStatus = statusResult.status;
            const reason = statusResult.reason;
            const mappedStatus = mapMtnPayoutStatus(mtnStatus);
            const retryable = shouldRetry(mtnStatus, reason);

            // Get retry count from metadata
            const retryCount = (payout.metadata?.retryCount || 0) as number;
            const MAX_RETRIES = 3;
            const RETRY_DELAY_MINUTES = 5; // Wait 5 minutes between retries

            // Check if we should retry
            const shouldRetryPayout = retryable && 
                                     mappedStatus === 'processing' && 
                                     retryCount < MAX_RETRIES &&
                                     payout.status === 'processing';

            // Check if enough time has passed since last retry attempt
            const lastRetryAttempt = payout.metadata?.lastRetryAttempt 
              ? new Date(payout.metadata.lastRetryAttempt as string).getTime()
              : payout.created_at 
                ? new Date(payout.created_at).getTime()
                : 0;
            const timeSinceLastRetry = Date.now() - lastRetryAttempt;
            const retryDelayMs = RETRY_DELAY_MINUTES * 60 * 1000;
            const canRetryNow = timeSinceLastRetry >= retryDelayMs;

            // Update if status changed
            if (mappedStatus !== payout.status) {
              const { error: updateError } = await supabase
                .from('payouts')
                .update({
                  status: mappedStatus,
                  transaction_id: statusResult.financialTransactionId || payout.transaction_id,
                  metadata: {
                    ...(payout.metadata || {}),
                    lastStatusCheck: new Date().toISOString(),
                    mtnStatus: mtnStatus,
                    mtnReason: reason,
                    statusCheckedAt: new Date().toISOString(),
                    retryable,
                  },
                })
                .eq('id', payout.id);

              if (updateError) {
                console.error('❌ Error updating payout status:', updateError);
                throw updateError;
              }

              console.log('📊 Payout status updated:', {
                payoutId: payout.id,
                transactionId: payout.transaction_id,
                oldStatus: payout.status,
                newStatus: mappedStatus,
                retryable,
              });

              // Send notification if status changed to failed or completed (with deduplication)
              if (mappedStatus === 'failed' && payout.driver_id) {
                await sendPayoutNotificationIfNeeded(
                  supabase,
                  payout,
                  'failed',
                  reason || mtnStatus || 'Transaction échouée',
                  'cron'
                );
              } else if (mappedStatus === 'completed' && payout.driver_id) {
                await sendPayoutNotificationIfNeeded(
                  supabase,
                  payout,
                  'completed',
                  undefined,
                  'cron'
                );
              }
            } else {
              // Update metadata even if status unchanged (to track last check)
              await supabase
                .from('payouts')
                .update({
                  metadata: {
                    ...(payout.metadata || {}),
                    lastStatusCheck: new Date().toISOString(),
                    mtnStatus: mtnStatus,
                    mtnReason: reason,
                    retryable,
                  },
                })
                .eq('id', payout.id);
            }

            // Attempt retry if conditions are met
            let retryAttempted = false;
            let retryResult = null;

            if (shouldRetryPayout && canRetryNow) {
              try {
                console.log('🔄 [RETRY] Attempting to retry payout:', {
                  payoutId: payout.id,
                  retryCount: retryCount + 1,
                  maxRetries: MAX_RETRIES,
                  mtnStatus,
                  reason,
                });

                // Get payment and booking info for retry
                const { data: payment } = await supabase
                  .from('payments')
                  .select('*')
                  .eq('id', payout.payment_id)
                  .single();

                const { data: booking } = await supabase
                  .from('bookings')
                  .select('*')
                  .eq('id', payout.booking_id)
                  .single();

                if (!payment || !booking) {
                  console.error('❌ [RETRY] Missing payment or booking data for retry');
                  throw new Error('Missing payment or booking data');
                }

                // Initialize orchestrator for retry
                const targetEnvironment = (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
                const orchestrator = new PayoutOrchestratorService(
                  {
                    subscriptionKey: process.env.DIRECT_MOMO_APIM_SUBSCRIPTION_KEY || process.env.MOMO_SUBSCRIPTION_KEY || '',
                    apiKey: process.env.DIRECT_MOMO_API_KEY || process.env.MOMO_API_KEY || '',
                    targetEnvironment,
                    callbackHost: process.env.MOMO_CALLBACK_HOST || process.env.NEXT_PUBLIC_APP_URL || '',
                    collectionPrimaryKey: process.env.DIRECT_MOMO_COLLECTION_PRIMARY_KEY || process.env.MOMO_COLLECTION_PRIMARY_KEY || '',
                    collectionUserId: process.env.DIRECT_MOMO_COLLECTION_USER_ID || process.env.MOMO_COLLECTION_USER_ID || '',
                    disbursementApiUser: process.env.DIRECT_MOMO_API_USER_DISBURSMENT || process.env.MOMO_DISBURSEMENT_API_USER,
                    disbursementApiKey: process.env.DIRECT_MOMO_API_KEY_DISBURSMENT || process.env.MOMO_DISBURSEMENT_API_KEY,
                    disbursementSubscriptionKey: process.env.DIRECT_MOMO_APIM_PAY_OUT_SUBSCRIPTION_KEY || process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
                  },
                  {
                    merchantId: process.env.DIRECT_OM_MERCHAND_NUMBER || process.env.ORANGE_MONEY_MERCHANT_ID || '',
                    merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || '',
                    environment: (process.env.DIRECT_OM_ENVIRONMENT || process.env.ORANGE_MONEY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
                    notificationUrl: process.env.DIRECT_OM_CALLBACK_URL || process.env.ORANGE_MONEY_NOTIFICATION_URL || '',
                    returnUrl: process.env.ORANGE_MONEY_RETURN_URL || '',
                    consumerUser: process.env.DIRECT_OM_CONSUMER_USER,
                    consumerSecret: process.env.DIRECT_OM_CONSUMER_SECRET,
                    apiUsername: process.env.DIRECT_OM_API_USERNAME,
                    apiPassword: process.env.DIRECT_OM_API_PASSWORD,
                    pinCode: process.env.DIRECT_OM_PIN_CODE,
                    merchantNumber: process.env.DIRECT_OM_MERCHAND_NUMBER,
                    tokenUrl: process.env.DIRECT_OM_TOKEN_URL,
                    baseUrl: process.env.DIRECT_OM_BASE_URL,
                  }
                );

                // Sandbox MTN test number override (same as original payout)
                let payoutPhoneNumber = payout.phone_number;
                const sandboxTestPhone = process.env.SANDBOX_MTN_TEST_PHONE;
                
                if (targetEnvironment === 'sandbox' && sandboxTestPhone) {
                  payoutPhoneNumber = sandboxTestPhone;
                }

                // Retry payout with same amount and details
                const retryPayoutResult = await orchestrator.payout({
                  phoneNumber: payoutPhoneNumber,
                  amount: parseFloat(payout.amount.toString()),
                  reason: payout.reason || `PikDrive Ride Payment - Booking ${payout.booking_id} (Retry ${retryCount + 1})`,
                  currency: payout.currency || 'XAF',
                  userId: payout.driver_id,
                });

                if (retryPayoutResult.response.success) {
                  // Update original payout with retry info
                  const { error: retryUpdateError } = await supabase
                    .from('payouts')
                    .update({
                      transaction_id: retryPayoutResult.response.verificationToken,
                      status: 'processing', // Reset to processing for new attempt
                      metadata: {
                        ...(payout.metadata || {}),
                        retryCount: retryCount + 1,
                        lastRetryAttempt: new Date().toISOString(),
                        retryHistory: [
                          ...((payout.metadata?.retryHistory as any[]) || []),
                          {
                            attempt: retryCount + 1,
                            timestamp: new Date().toISOString(),
                            previousTransactionId: payout.transaction_id,
                            newTransactionId: retryPayoutResult.response.verificationToken,
                            reason: `Retry due to: ${mtnStatus} - ${reason}`,
                          },
                        ],
                        lastStatusCheck: new Date().toISOString(),
                        mtnStatus: mtnStatus,
                        mtnReason: reason,
                        retryable: true,
                      },
                    })
                    .eq('id', payout.id);

                  if (retryUpdateError) {
                    console.error('❌ [RETRY] Error updating payout with retry info:', retryUpdateError);
                  } else {
                    retryAttempted = true;
                    retryResult = {
                      success: true,
                      newTransactionId: retryPayoutResult.response.verificationToken,
                      attempt: retryCount + 1,
                    };
                    console.log('✅ [RETRY] Payout retry successful:', {
                      payoutId: payout.id,
                      attempt: retryCount + 1,
                      newTransactionId: retryPayoutResult.response.verificationToken,
                    });
                  }
                } else {
                  console.error('❌ [RETRY] Payout retry failed:', retryPayoutResult.response.message);
                  retryResult = {
                    success: false,
                    error: retryPayoutResult.response.message,
                    attempt: retryCount + 1,
                  };
                }
              } catch (retryError) {
                console.error('❌ [RETRY] Exception during payout retry:', retryError);
                retryResult = {
                  success: false,
                  error: retryError instanceof Error ? retryError.message : 'Unknown error',
                  attempt: retryCount + 1,
                };
              }
            } else if (shouldRetryPayout && !canRetryNow) {
              const minutesRemaining = Math.ceil((retryDelayMs - timeSinceLastRetry) / 60000);
              console.log('⏳ [RETRY] Retry delayed - waiting for cooldown:', {
                payoutId: payout.id,
                minutesRemaining,
                retryCount,
              });
            } else if (retryable && retryCount >= MAX_RETRIES) {
              console.log('🛑 [RETRY] Max retries reached, marking as failed:', {
                payoutId: payout.id,
                retryCount,
                maxRetries: MAX_RETRIES,
              });

              // Mark as failed after max retries
              const { error: updateError } = await supabase
                .from('payouts')
                .update({
                  status: 'failed',
                  metadata: {
                    ...(payout.metadata || {}),
                    maxRetriesReached: true,
                    lastStatusCheck: new Date().toISOString(),
                    mtnStatus: mtnStatus,
                    mtnReason: reason,
                  },
                })
                .eq('id', payout.id);

              if (!updateError && payout.driver_id) {
                // Send notification when max retries reached (with deduplication)
                await sendPayoutNotificationIfNeeded(
                  supabase,
                  { ...payout, status: 'failed' },
                  'failed',
                  `Toutes les tentatives ont échoué (${MAX_RETRIES} tentatives). ${reason || mtnStatus || 'Transaction échouée'}`,
                  'cron'
                );
              }
            }

            return {
              payoutId: payout.id,
              oldStatus: payout.status,
              newStatus: mappedStatus,
              retryable,
              retryAttempted,
              retryResult,
              error: null
            };
          }

          // Check pawaPay payouts
          if (payout.provider === 'pawapay' && payout.transaction_id) {
            const pawapayService = new PawaPayService({
              apiToken: process.env.PAWAPAY_API_TOKEN || "",
              baseUrl: process.env.PAWAPAY_BASE_URL || (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION ? PawaPayApiUrl.PRODUCTION : PawaPayApiUrl.SANDBOX),
              callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/pawapay`,
              environment: (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment,
            });

            // Use checkPayoutStatus with transaction_id (which is the payoutId)
            const statusResult = await pawapayService.checkPayoutStatus(payout.transaction_id);

            if (!statusResult) {
              console.error('❌ Failed to check pawaPay payout status - no result returned');
              throw new Error('Failed to check payout status');
            }

            const pawapayStatus = statusResult.status;
            const reason = statusResult.reason;
            const mappedStatus = mapPawaPayStatus(pawapayStatus);

            // Update if status changed
            if (mappedStatus !== payout.status) {
              const { error: updateError } = await supabase
                .from('payouts')
                .update({
                  status: mappedStatus,
                  transaction_id: statusResult.transactionId || payout.transaction_id,
                  metadata: {
                    ...(payout.metadata || {}),
                    lastStatusCheck: new Date().toISOString(),
                    pawapayStatus: pawapayStatus,
                    pawapayReason: reason,
                    statusCheckedAt: new Date().toISOString(),
                  },
                })
                .eq('id', payout.id);

              if (updateError) {
                console.error('❌ Error updating pawaPay payout status:', updateError);
                throw updateError;
              }

              console.log('📊 pawaPay payout status updated:', {
                payoutId: payout.id,
                transactionId: payout.transaction_id,
                oldStatus: payout.status,
                newStatus: mappedStatus,
              });

              // Send notification if status changed to failed or completed
              if (mappedStatus === 'failed' && payout.driver_id) {
                await sendPayoutNotificationIfNeeded(
                  supabase,
                  payout,
                  'failed',
                  reason || pawapayStatus || 'Transaction échouée',
                  'cron'
                );
              } else if (mappedStatus === 'completed' && payout.driver_id) {
                await sendPayoutNotificationIfNeeded(
                  supabase,
                  payout,
                  'completed',
                  undefined,
                  'cron'
                );
              }
            } else {
              // Update metadata even if status unchanged
              await supabase
                .from('payouts')
                .update({
                  metadata: {
                    ...(payout.metadata || {}),
                    lastStatusCheck: new Date().toISOString(),
                    pawapayStatus: pawapayStatus,
                    pawapayReason: reason,
                  },
                })
                .eq('id', payout.id);
            }

            return {
              payoutId: payout.id,
              oldStatus: payout.status,
              newStatus: mappedStatus,
              error: null
            };
          }

          return {
            payoutId: payout.id,
            oldStatus: payout.status,
            newStatus: payout.status,
            retryable: false,
            error: null
          };
        } catch (error) {
          console.error('❌ Error checking payout:', {
            payoutId: payout.id,
            error
          });

          return {
            payoutId: payout.id,
            oldStatus: payout.status,
            newStatus: payout.status,
            retryable: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
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
