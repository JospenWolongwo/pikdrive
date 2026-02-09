/**
 * Payout Retry Service
 * Handles retry logic for failed MTN payouts
 */

import { PaymentOrchestratorService, PaymentServiceFactory, shouldRetry } from '@/lib/payment';
import type { SupabaseClient } from '@supabase/supabase-js';

interface PayoutRecord {
  id: string;
  transaction_id: string;
  status: string;
  amount: number | string;
  currency: string;
  phone_number: string;
  reason: string | null;
  booking_id: string;
  payment_id: string;
  driver_id: string;
  created_at: string;
  metadata?: {
    retryCount?: number;
    lastRetryAttempt?: string;
    retryHistory?: any[];
    [key: string]: any;
  };
}

interface RetryResult {
  success: boolean;
  newTransactionId?: string;
  error?: string;
  attempt: number;
}

interface RetryCheckResult {
  shouldRetry: boolean;
  canRetryNow: boolean;
  retryCount: number;
  minutesRemaining?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MINUTES = 5;

export class PayoutRetryService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Check if payout should be retried and if it can be retried now
   */
  checkRetryConditions(
    payout: PayoutRecord,
    providerStatus: string,
    reason?: string
  ): RetryCheckResult {
    const retryCount = (payout.metadata?.retryCount || 0) as number;
    const retryable = shouldRetry(providerStatus, reason);

    const shouldRetryPayout =
      retryable &&
      payout.status === 'processing' &&
      retryCount < MAX_RETRIES;

    // Check if enough time has passed since last retry attempt
    const lastRetryAttempt = payout.metadata?.lastRetryAttempt
      ? new Date(payout.metadata.lastRetryAttempt as string).getTime()
      : payout.created_at
        ? new Date(payout.created_at).getTime()
        : 0;
    const timeSinceLastRetry = Date.now() - lastRetryAttempt;
    const retryDelayMs = RETRY_DELAY_MINUTES * 60 * 1000;
    const canRetryNow = timeSinceLastRetry >= retryDelayMs;

    const minutesRemaining = canRetryNow
      ? undefined
      : Math.ceil((retryDelayMs - timeSinceLastRetry) / 60000);

    return {
      shouldRetry: shouldRetryPayout,
      canRetryNow: shouldRetryPayout && canRetryNow,
      retryCount,
      minutesRemaining,
    };
  }

  /**
   * Execute retry for a payout
   */
  async executeRetry(
    payout: PayoutRecord,
    providerStatus: string,
    reason?: string
  ): Promise<RetryResult> {
    const retryCheck = this.checkRetryConditions(payout, providerStatus, reason);

    if (!retryCheck.shouldRetry) {
      return {
        success: false,
        error: 'Retry conditions not met',
        attempt: retryCheck.retryCount,
      };
    }

    if (!retryCheck.canRetryNow) {
      console.log('⏳ [RETRY] Retry delayed - waiting for cooldown:', {
        payoutId: payout.id,
        minutesRemaining: retryCheck.minutesRemaining,
        retryCount: retryCheck.retryCount,
      });
      return {
        success: false,
        error: `Retry delayed - ${retryCheck.minutesRemaining} minutes remaining`,
        attempt: retryCheck.retryCount,
      };
    }

    try {
      console.log('🔄 [RETRY] Attempting to retry payout:', {
        payoutId: payout.id,
        retryCount: retryCheck.retryCount + 1,
        maxRetries: MAX_RETRIES,
        providerStatus,
        reason,
      });

      // Get payment and booking info for retry
      const { data: payment } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', payout.payment_id)
        .single();

      const { data: booking } = await this.supabase
        .from('bookings')
        .select('*')
        .eq('id', payout.booking_id)
        .single();

      if (!payment || !booking) {
        console.error('❌ [RETRY] Missing payment or booking data for retry');
        throw new Error('Missing payment or booking data');
      }

      // Initialize orchestrator for retry
      const orchestrator = this.createOrchestrator();

      // Sandbox MTN test number override
      let payoutPhoneNumber = payout.phone_number;
      const targetEnvironment =
        (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as
          | 'sandbox'
          | 'production';
      const sandboxTestPhone = process.env.SANDBOX_MTN_TEST_PHONE;

      if (targetEnvironment === 'sandbox' && sandboxTestPhone) {
        payoutPhoneNumber = sandboxTestPhone;
      }

      // Retry payout with same amount and details
      const retryPayoutResult = await orchestrator.payout({
        phoneNumber: payoutPhoneNumber,
        amount: parseFloat(payout.amount.toString()),
        reason:
          payout.reason ||
          `PikDrive Ride Payment - Booking ${payout.booking_id} (Retry ${retryCheck.retryCount + 1})`,
        currency: payout.currency || 'XAF',
        userId: payout.driver_id,
      });

      if (retryPayoutResult.response.success) {
        // Update original payout with retry info
        const { error: retryUpdateError } = await this.supabase
          .from('payouts')
          .update({
            transaction_id: retryPayoutResult.response.verificationToken,
            status: 'processing', // Reset to processing for new attempt
            metadata: {
              ...(payout.metadata || {}),
              retryCount: retryCheck.retryCount + 1,
              lastRetryAttempt: new Date().toISOString(),
              retryHistory: [
                ...((payout.metadata?.retryHistory as any[]) || []),
                {
                  attempt: retryCheck.retryCount + 1,
                  timestamp: new Date().toISOString(),
                  previousTransactionId: payout.transaction_id,
                  newTransactionId: retryPayoutResult.response.verificationToken,
                  reason: `Retry due to: ${providerStatus} - ${reason || 'Unknown'}`,
                },
              ],
              lastStatusCheck: new Date().toISOString(),
              retryable: true,
            },
          })
          .eq('id', payout.id);

        if (retryUpdateError) {
          console.error(
            '❌ [RETRY] Error updating payout with retry info:',
            retryUpdateError
          );
          return {
            success: false,
            error: retryUpdateError.message,
            attempt: retryCheck.retryCount + 1,
          };
        }

        console.log('✅ [RETRY] Payout retry successful:', {
          payoutId: payout.id,
          attempt: retryCheck.retryCount + 1,
          newTransactionId: retryPayoutResult.response.verificationToken,
        });

        return {
          success: true,
          newTransactionId: retryPayoutResult.response.verificationToken || undefined,
          attempt: retryCheck.retryCount + 1,
        };
      } else {
        console.error(
          '❌ [RETRY] Payout retry failed:',
          retryPayoutResult.response.message
        );
        return {
          success: false,
          error: retryPayoutResult.response.message,
          attempt: retryCheck.retryCount + 1,
        };
      }
    } catch (retryError) {
      console.error('❌ [RETRY] Exception during payout retry:', retryError);
      return {
        success: false,
        error:
          retryError instanceof Error ? retryError.message : 'Unknown error',
        attempt: retryCheck.retryCount + 1,
      };
    }
  }

  /**
   * Handle max retries reached - mark payout as failed
   */
  async handleMaxRetriesReached(
    payout: PayoutRecord,
    providerStatus: string,
    reason?: string
  ): Promise<void> {
    const retryCount = (payout.metadata?.retryCount || 0) as number;

    if (retryCount < MAX_RETRIES) {
      return; // Not at max retries yet
    }

    console.log('🛑 [RETRY] Max retries reached, marking as failed:', {
      payoutId: payout.id,
      retryCount,
      maxRetries: MAX_RETRIES,
    });

    const { error: updateError } = await this.supabase
      .from('payouts')
      .update({
        status: 'failed',
        metadata: {
          ...(payout.metadata || {}),
          maxRetriesReached: true,
          lastStatusCheck: new Date().toISOString(),
        },
      })
      .eq('id', payout.id);

    if (updateError) {
      console.error(
        '❌ [RETRY] Error marking payout as failed:',
        updateError
      );
      throw updateError;
    }
  }

  /**
   * Create orchestrator service for retry
   */
  private createOrchestrator(): PaymentOrchestratorService {
    return new PaymentOrchestratorService(
      {
        subscriptionKey:
          process.env.DIRECT_MOMO_APIM_SUBSCRIPTION_KEY ||
          process.env.MOMO_SUBSCRIPTION_KEY ||
          '',
        apiKey:
          process.env.DIRECT_MOMO_API_KEY || process.env.MOMO_API_KEY || '',
        targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT ||
          'sandbox') as 'sandbox' | 'production',
        callbackHost:
          process.env.MOMO_CALLBACK_HOST ||
          process.env.NEXT_PUBLIC_APP_URL ||
          '',
        collectionPrimaryKey:
          process.env.DIRECT_MOMO_COLLECTION_PRIMARY_KEY ||
          process.env.MOMO_COLLECTION_PRIMARY_KEY ||
          '',
        collectionUserId:
          process.env.DIRECT_MOMO_COLLECTION_USER_ID ||
          process.env.MOMO_COLLECTION_USER_ID ||
          '',
        disbursementApiUser:
          process.env.DIRECT_MOMO_API_USER_DISBURSMENT ||
          process.env.MOMO_DISBURSEMENT_API_USER,
        disbursementApiKey:
          process.env.DIRECT_MOMO_API_KEY_DISBURSMENT ||
          process.env.MOMO_DISBURSEMENT_API_KEY,
        disbursementSubscriptionKey:
          process.env.DIRECT_MOMO_APIM_PAY_OUT_SUBSCRIPTION_KEY ||
          process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
      },
      {
        merchantId:
          process.env.DIRECT_OM_MERCHAND_NUMBER ||
          process.env.ORANGE_MONEY_MERCHANT_ID ||
          '',
        merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || '',
        environment: (process.env.DIRECT_OM_ENVIRONMENT ||
          process.env.ORANGE_MONEY_ENVIRONMENT ||
          'sandbox') as 'sandbox' | 'production',
        notificationUrl:
          process.env.DIRECT_OM_CALLBACK_URL ||
          process.env.ORANGE_MONEY_NOTIFICATION_URL ||
          '',
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
  }
}

