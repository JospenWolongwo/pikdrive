import type { SupabaseClient } from '@supabase/supabase-js';
import { ServerPaymentService, ServerPaymentOrchestrationService, ServerRefundStatusService } from '@/lib/services/server';
import { mapPawaPayStatus } from '@/lib/payment';
import { TransactionType } from '@/types/payment-ext';

export interface PawaPayCallbackResult {
  message: string;
  error?: string;
}

/**
 * Server-side service to handle pawaPay callbacks (deposits and payouts).
 * Keeps API routes thin and centralizes business logic.
 */
export class ServerPawaPayCallbackService {
  private paymentService: ServerPaymentService;
  private orchestrationService: ServerPaymentOrchestrationService;
  private refundStatusService: ServerRefundStatusService;

  constructor(private supabase: SupabaseClient) {
    this.paymentService = new ServerPaymentService(supabase);
    this.orchestrationService = new ServerPaymentOrchestrationService(supabase);
    this.refundStatusService = new ServerRefundStatusService(supabase);
  }

  async handleCallback(callback: any): Promise<PawaPayCallbackResult> {
    const {
      depositId,
      payoutId,
      status,
      transactionId,
      externalId,
      failureReason,
      type, // 'deposit' or 'payout'
    } = callback ?? {};

    const isDeposit = Boolean(depositId) || type === TransactionType.DEPOSIT;
    const isPayout = Boolean(payoutId) || type === TransactionType.PAYOUT;

    const transactionReferenceId = depositId || payoutId || externalId || transactionId;

    if (!transactionReferenceId) {
      console.error('[CALLBACK] No transaction reference in pawaPay callback');
      return { message: 'Missing transaction reference', error: 'Missing transaction reference' };
    }

    console.log('[CALLBACK] Processing pawaPay callback:', {
      isDeposit,
      isPayout,
      transactionReferenceId,
      status,
    });

    if (isDeposit) {
      await this.handleDepositCallback({
        transactionReferenceId,
        status,
        transactionId,
        failureReason,
        callback,
      });
      return { message: 'Callback received' };
    }

    if (isPayout) {
      await this.handlePayoutCallback({
        transactionReferenceId,
        status,
        failureReason,
        transactionId,
        callback,
      });
      return { message: 'Callback received' };
    }

    console.warn('[CALLBACK] Unknown callback type:', callback);
    return { message: 'Callback received' };
  }

  private async handleDepositCallback(params: {
    transactionReferenceId: string;
    status: string;
    transactionId?: string;
    failureReason?: string;
    callback: any;
  }): Promise<void> {
    const { transactionReferenceId, status, transactionId, failureReason, callback } = params;

    let payment = await this.paymentService.getPaymentByTransactionId(transactionReferenceId);

    if (!payment && transactionReferenceId) {
      try {
        const { data } = await this.supabase
          .from('payments')
          .select('*')
          .eq('id', transactionReferenceId)
          .single();
        if (data) payment = data as any;
      } catch (e) {
        console.log('Payment not found by ID:', transactionReferenceId);
      }
    }

    if (!payment) {
      console.error('[CALLBACK] Payment not found:', transactionReferenceId);
      return;
    }

    const mappedStatus = mapPawaPayStatus(status);

    if (payment.status === mappedStatus) {
      console.log('[CALLBACK] Payment already in target status, skipping orchestration:', {
        payment_id: payment.id,
        status: payment.status,
      });
      return;
    }

    await this.orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
      transaction_id: transactionId || transactionReferenceId,
      provider_response: callback,
      error_message: failureReason || undefined,
    });

    console.log('[CALLBACK] pawaPay deposit callback processed successfully');
  }

  private async handlePayoutCallback(params: {
    transactionReferenceId: string;
    status: string;
    failureReason?: string;
    transactionId?: string;
    callback: any;
  }): Promise<void> {
    const { transactionReferenceId, status, failureReason, transactionId, callback } = params;

    const mappedStatus = mapPawaPayStatus(status);

    let payout;
    try {
      const { data } = await this.supabase
        .from('payouts')
        .select('*')
        .eq('transaction_id', transactionReferenceId)
        .single();
      if (data) payout = data as any;
    } catch (e) {
      console.log('Payout not found by transaction_id:', transactionReferenceId);
    }

    if (!payout) {
      console.error('[CALLBACK] Payout not found:', transactionReferenceId);
    } else {
      const { error: updateError } = await this.supabase
        .from('payouts')
        .update({
          status: mappedStatus,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(payout.metadata || {}),
            lastCallback: new Date().toISOString(),
            callbackData: callback,
            transactionId: transactionId || transactionReferenceId,
            failureReason: failureReason || null,
          },
        })
        .eq('id', payout.id);

      if (updateError) {
        console.error('[CALLBACK] Error updating payout:', updateError);
      } else {
        console.log('[CALLBACK] pawaPay payout callback processed successfully');
      }
    }

    await this.handleRefundFromPayout({
      transactionReferenceId,
      mappedStatus,
      status,
      callback,
    });
  }

  private async handleRefundFromPayout(params: {
    transactionReferenceId: string;
    mappedStatus: string;
    status: string;
    callback: any;
  }): Promise<void> {
    const { transactionReferenceId, mappedStatus, status, callback } = params;

    try {
      const refundResult = await this.refundStatusService.updateRefundByTransactionId(
        transactionReferenceId,
        mappedStatus,
        {
          source: 'pawapay_callback',
          providerStatus: status,
          callbackPayload: callback,
          updateEvenIfSame: true,
        }
      );

      if (!refundResult.refundFound) {
        return;
      }
    } catch (refundError) {
      console.error('[CALLBACK] Error handling refund linkage in pawaPay payout callback:', refundError);
    }
  }
}
