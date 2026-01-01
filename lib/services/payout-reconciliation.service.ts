/**
 * Payout Reconciliation Service
 * Handles status checking and reconciliation for driver payouts
 */

import { PaymentServiceFactory } from '@/lib/payment/payment-service-factory';
import { PayoutRetryService } from './payout-retry.service';
import { mapMtnPayoutStatus, shouldRetry } from '@/lib/payment/retry-logic';
import { mapOrangeMoneyStatus, mapPawaPayStatus } from '@/lib/payment/status-mapper';
import { sendPayoutNotificationIfNeeded } from '@/lib/payment/payout-notification-helper';
import type { SupabaseClient } from '@supabase/supabase-js';

interface PayoutRecord {
  id: string;
  provider: string;
  transaction_id: string | null;
  status: string;
  driver_id: string | null;
  amount: number | string;
  currency: string;
  phone_number: string;
  reason: string | null;
  booking_id: string;
  payment_id: string;
  created_at: string;
  metadata?: {
    retryCount?: number;
    lastRetryAttempt?: string;
    retryHistory?: any[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface ReconciliationResult {
  payoutId: string;
  oldStatus: string;
  newStatus: string;
  retryable?: boolean;
  retryAttempted?: boolean;
  retryResult?: any;
  error: string | null;
}

export class PayoutReconciliationService {
  private readonly retryService: PayoutRetryService;

  constructor(private readonly supabase: SupabaseClient) {
    this.retryService = new PayoutRetryService(supabase);
  }

  /**
   * Reconcile a single payout
   */
  async reconcilePayout(payout: PayoutRecord): Promise<ReconciliationResult> {
    try {
      // If using pawaPay exclusively, skip MTN/Orange payouts
      const usePawaPay = process.env.USE_PAWAPAY === 'true';
      if (usePawaPay && payout.provider !== 'pawapay') {
        console.log('⏭️ [RECONCILE] Skipping non-pawaPay payout (USE_PAWAPAY enabled):', {
          payoutId: payout.id,
          provider: payout.provider,
        });
        return {
          payoutId: payout.id,
          oldStatus: payout.status,
          newStatus: payout.status,
          retryable: false,
          error: null,
        };
      }

      // Check MTN payouts
      if (payout.provider === 'mtn' && payout.transaction_id) {
        return await this.reconcileMTNPayout(payout);
      }

      // Check Orange Money payouts
      if (payout.provider === 'orange' && payout.transaction_id) {
        return await this.reconcileOrangePayout(payout);
      }

      // Check pawaPay payouts
      if (payout.provider === 'pawapay' && payout.transaction_id) {
        return await this.reconcilePawaPayPayout(payout);
      }

      // Unsupported provider or missing transaction_id
      return {
        payoutId: payout.id,
        oldStatus: payout.status,
        newStatus: payout.status,
        retryable: false,
        error: null,
      };
    } catch (error) {
      console.error('❌ Error reconciling payout:', {
        payoutId: payout.id,
        error,
      });

      return {
        payoutId: payout.id,
        oldStatus: payout.status,
        newStatus: payout.status,
        retryable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reconcile multiple payouts in batch
   */
  async reconcilePayouts(payouts: PayoutRecord[]): Promise<ReconciliationResult[]> {
    return Promise.all(payouts.map(payout => this.reconcilePayout(payout)));
  }

  /**
   * Reconcile MTN payout (includes retry logic)
   */
  private async reconcileMTNPayout(payout: PayoutRecord): Promise<ReconciliationResult> {
    const mtnService = PaymentServiceFactory.createMTNServiceForPayouts();
    const statusResult = await mtnService.checkPayoutStatus(payout.transaction_id!);

    if (!statusResult) {
      console.error('❌ Failed to check MTN payout status - no result returned');
      throw new Error('Failed to check payout status');
    }

    const mtnStatus = statusResult.status;
    const reason = statusResult.reason;
    const mappedStatus = mapMtnPayoutStatus(mtnStatus);
    const retryable = shouldRetry(mtnStatus, reason);

    // Update if status changed
    if (mappedStatus !== payout.status) {
      const { error: updateError } = await this.supabase
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
        console.error('❌ Error updating MTN payout status:', updateError);
        throw updateError;
      }

      console.log('📊 MTN payout status updated:', {
        payoutId: payout.id,
        transactionId: payout.transaction_id,
        oldStatus: payout.status,
        newStatus: mappedStatus,
        retryable,
      });

      // Send notification if status changed to failed or completed
      if (mappedStatus === 'failed' && payout.driver_id) {
        await sendPayoutNotificationIfNeeded(
          this.supabase,
          { ...payout, driver_id: payout.driver_id, transaction_id: payout.transaction_id || undefined },
          'failed',
          reason || mtnStatus || 'Transaction échouée',
          'cron'
        );
      } else if (mappedStatus === 'completed' && payout.driver_id) {
        await sendPayoutNotificationIfNeeded(
          this.supabase,
          { ...payout, driver_id: payout.driver_id, transaction_id: payout.transaction_id || undefined },
          'completed',
          undefined,
          'cron'
        );
      }
    } else {
      // Update metadata even if status unchanged (to track last check)
      await this.supabase
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

    // Handle retry logic for MTN payouts
    let retryAttempted = false;
    let retryResult = null;

    const retryCheck = this.retryService.checkRetryConditions(
      payout as any,
      mtnStatus,
      reason
    );

    if (retryCheck.shouldRetry && retryCheck.canRetryNow) {
      retryResult = await this.retryService.executeRetry(
        payout as any,
        mtnStatus,
        reason
      );
      retryAttempted = retryResult.success;
    } else if (retryCheck.shouldRetry && !retryCheck.canRetryNow) {
      // Log cooldown message
      console.log('⏳ [RETRY] Retry delayed - waiting for cooldown:', {
        payoutId: payout.id,
        minutesRemaining: retryCheck.minutesRemaining,
        retryCount: retryCheck.retryCount,
      });
    } else if (retryable && retryCheck.retryCount >= 3) {
      // Handle max retries reached
      await this.retryService.handleMaxRetriesReached(payout as any, mtnStatus, reason);

      // Send notification when max retries reached
      if (payout.driver_id) {
        await sendPayoutNotificationIfNeeded(
          this.supabase,
          { ...payout, driver_id: payout.driver_id, transaction_id: payout.transaction_id || undefined },
          'failed',
          `Toutes les tentatives ont échoué (3 tentatives). ${reason || mtnStatus || 'Transaction échouée'}`,
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
      error: null,
    };
  }

  /**
   * Reconcile Orange Money payout
   * Note: Orange Money uses the same checkPayment method for payouts (using payToken)
   */
  private async reconcileOrangePayout(payout: PayoutRecord): Promise<ReconciliationResult> {
    const orangeService = PaymentServiceFactory.createOrangeMoneyService();
    const checkResult = await orangeService.checkPayment(payout.transaction_id!);

    if (!checkResult.response.success) {
      console.error('❌ Failed to check Orange Money payout status:', checkResult.response.message);
      throw new Error(checkResult.response.message);
    }

    // Extract status from Orange Money response
    const orangeStatus = checkResult.response.apiResponse?.data?.status || 
                         checkResult.response.transactionStatus || 
                         'UNKNOWN';
    
    // Normalize Orange Money status (handle typo variants)
    const normalizedStatus = orangeStatus === 'SUCCESSFULL' ? 'SUCCESSFUL' : orangeStatus;
    const mappedStatus = mapOrangeMoneyStatus(normalizedStatus);

    // Update if status changed
    if (mappedStatus !== payout.status) {
      const { error: updateError } = await this.supabase
        .from('payouts')
        .update({
          status: mappedStatus,
          transaction_id: payout.transaction_id,
          metadata: {
            ...(payout.metadata || {}),
            lastStatusCheck: new Date().toISOString(),
            orangeStatus: orangeStatus,
            statusCheckedAt: new Date().toISOString(),
          },
        })
        .eq('id', payout.id);

      if (updateError) {
        console.error('❌ Error updating Orange Money payout status:', updateError);
        throw updateError;
      }

      console.log('📊 Orange Money payout status updated:', {
        payoutId: payout.id,
        transactionId: payout.transaction_id,
        oldStatus: payout.status,
        newStatus: mappedStatus,
      });

      // Send notification if status changed to failed or completed
      if (mappedStatus === 'failed' && payout.driver_id) {
        await sendPayoutNotificationIfNeeded(
          this.supabase,
          { ...payout, driver_id: payout.driver_id, transaction_id: payout.transaction_id || undefined },
          'failed',
          orangeStatus || 'Transaction échouée',
          'cron'
        );
      } else if (mappedStatus === 'completed' && payout.driver_id) {
        await sendPayoutNotificationIfNeeded(
          this.supabase,
          { ...payout, driver_id: payout.driver_id, transaction_id: payout.transaction_id || undefined },
          'completed',
          undefined,
          'cron'
        );
      }
    } else {
      // Update metadata even if status unchanged
      await this.supabase
        .from('payouts')
        .update({
          metadata: {
            ...(payout.metadata || {}),
            lastStatusCheck: new Date().toISOString(),
            orangeStatus: orangeStatus,
          },
        })
        .eq('id', payout.id);
    }

    return {
      payoutId: payout.id,
      oldStatus: payout.status,
      newStatus: mappedStatus,
      retryable: false, // Orange Money doesn't have retry logic
      error: null,
    };
  }

  /**
   * Reconcile pawaPay payout
   */
  private async reconcilePawaPayPayout(payout: PayoutRecord): Promise<ReconciliationResult> {
    const pawapayService = PaymentServiceFactory.createPawaPayService();
    const statusResult = await pawapayService.checkPayoutStatus(payout.transaction_id!);

    if (!statusResult) {
      console.error('❌ Failed to check pawaPay payout status - no result returned');
      throw new Error('Failed to check payout status');
    }

    const pawapayStatus = statusResult.status;
    const reason = statusResult.reason;
    const mappedStatus = mapPawaPayStatus(pawapayStatus);

    // Update if status changed
    if (mappedStatus !== payout.status) {
      const { error: updateError } = await this.supabase
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
          this.supabase,
          { ...payout, driver_id: payout.driver_id, transaction_id: payout.transaction_id || undefined },
          'failed',
          reason || pawapayStatus || 'Transaction échouée',
          'cron'
        );
      } else if (mappedStatus === 'completed' && payout.driver_id) {
        await sendPayoutNotificationIfNeeded(
          this.supabase,
          { ...payout, driver_id: payout.driver_id, transaction_id: payout.transaction_id || undefined },
          'completed',
          undefined,
          'cron'
        );
      }
    } else {
      // Update metadata even if status unchanged
      await this.supabase
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
      retryable: false, // pawaPay doesn't have retry logic
      error: null,
    };
  }
}

