/**
 * Payment Reconciliation Service
 * Handles status checking and reconciliation for customer payments (payins)
 */

import { PaymentServiceFactory } from '@/lib/payment/payment-service-factory';
import { mapMtnMomoStatus, mapOrangeMoneyStatus, mapPawaPayStatus } from '@/lib/payment/status-mapper';
import type { ServerPaymentOrchestrationService } from './server/payment-orchestration-service';
import type { Payment } from '@/types/payment';

interface PaymentRecord extends Payment {
  [key: string]: any;
}

interface ReconciliationResult {
  paymentId: string;
  oldStatus: string;
  newStatus: string;
  error: string | null;
}

export class PaymentReconciliationService {
  constructor(
    private readonly orchestrationService: ServerPaymentOrchestrationService
  ) {}

  /**
   * Reconcile a single payment
   */
  async reconcilePayment(payment: PaymentRecord): Promise<ReconciliationResult> {
    try {
      // If using pawaPay exclusively, skip MTN/Orange payments
      const usePawaPay = process.env.USE_PAWAPAY === 'true';
      if (usePawaPay && payment.provider !== 'pawapay') {
        console.log('⏭️ [RECONCILE] Skipping non-pawaPay payment (USE_PAWAPAY enabled):', {
          paymentId: payment.id,
          provider: payment.provider,
        });
        return {
          paymentId: payment.id,
          oldStatus: payment.status,
          newStatus: payment.status,
          error: null,
        };
      }

      // Check MTN payments
      if (payment.provider === 'mtn' && payment.transaction_id) {
        return await this.reconcileMTNPayment(payment);
      }

      // Check Orange Money payments
      if (payment.provider === 'orange' && payment.transaction_id) {
        return await this.reconcileOrangePayment(payment);
      }

      // Check pawaPay payments
      if (payment.provider === 'pawapay' && payment.transaction_id) {
        return await this.reconcilePawaPayPayment(payment);
      }

      // Unsupported provider or missing transaction_id
      return {
        paymentId: payment.id,
        oldStatus: payment.status,
        newStatus: payment.status,
        error: null,
      };
    } catch (error) {
      console.error('❌ Error reconciling payment:', {
        paymentId: payment.id,
        error,
      });

      return {
        paymentId: payment.id,
        oldStatus: payment.status,
        newStatus: payment.status,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reconcile multiple payments in batch
   */
  async reconcilePayments(payments: PaymentRecord[]): Promise<ReconciliationResult[]> {
    return Promise.all(payments.map(payment => this.reconcilePayment(payment)));
  }

  /**
   * Reconcile MTN payment
   */
  private async reconcileMTNPayment(payment: PaymentRecord): Promise<ReconciliationResult> {
    const mtnService = PaymentServiceFactory.createMTNServiceForPayments();
    const checkResult = await mtnService.checkPayment(payment.transaction_id!);

    if (!checkResult.response.success) {
      console.error('❌ Failed to check MTN payment status:', checkResult.response.message);
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
      await this.orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
        transaction_id: payment.transaction_id!,
        provider_response: checkResult.response.apiResponse,
      });
    }

    console.log('📊 MTN payment status reconciled:', {
      paymentId: payment.id,
      transactionId: payment.transaction_id,
      oldStatus: payment.status,
      newStatus: mappedStatus,
    });

    return {
      paymentId: payment.id,
      oldStatus: payment.status,
      newStatus: mappedStatus,
      error: null,
    };
  }

  /**
   * Reconcile Orange Money payment
   */
  private async reconcileOrangePayment(payment: PaymentRecord): Promise<ReconciliationResult> {
    const orangeService = PaymentServiceFactory.createOrangeMoneyService();
    const checkResult = await orangeService.checkPayment(payment.transaction_id!);

    if (!checkResult.response.success) {
      console.error('❌ Failed to check Orange Money payment status:', checkResult.response.message);
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
    if (mappedStatus !== payment.status) {
      await this.orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
        transaction_id: payment.transaction_id!,
        provider_response: checkResult.response.apiResponse,
      });
    }

    console.log('📊 Orange Money payment status reconciled:', {
      paymentId: payment.id,
      transactionId: payment.transaction_id,
      oldStatus: payment.status,
      newStatus: mappedStatus,
    });

    return {
      paymentId: payment.id,
      oldStatus: payment.status,
      newStatus: mappedStatus,
      error: null,
    };
  }

  /**
   * Reconcile pawaPay payment
   */
  private async reconcilePawaPayPayment(payment: PaymentRecord): Promise<ReconciliationResult> {
    const pawapayService = PaymentServiceFactory.createPawaPayService();
    const checkResult = await pawapayService.checkPayment(payment.transaction_id!);

    if (!checkResult.response.success) {
      console.error('❌ Failed to check pawaPay payment status:', checkResult.response.message);
      throw new Error(checkResult.response.message);
    }

    // Extract status from pawaPay response
    const pawapayStatus = checkResult.response.apiResponse?.status || 
                         checkResult.response.transactionStatus || 
                         'UNKNOWN';
    const mappedStatus = mapPawaPayStatus(pawapayStatus);

    // Update if status changed
    if (mappedStatus !== payment.status) {
      await this.orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
        transaction_id: payment.transaction_id!,
        provider_response: checkResult.response.apiResponse,
      });
    }

    console.log('📊 pawaPay payment status reconciled:', {
      paymentId: payment.id,
      transactionId: payment.transaction_id,
      oldStatus: payment.status,
      newStatus: mappedStatus,
    });

    return {
      paymentId: payment.id,
      oldStatus: payment.status,
      newStatus: mappedStatus,
      error: null,
    };
  }
}

