import type { SupabaseClient } from '@supabase/supabase-js';

type RefundRecord = {
  id: string;
  status: string;
  refund_type?: string | null;
  booking_id?: string | null;
  metadata?: Record<string, any> | null;
};

export type RefundUpdateContext = {
  source: 'refund_callback' | 'pawapay_callback' | 'cron' | 'mtn_payout_callback' | 'orange_callback';
  providerStatus?: string;
  callbackPayload?: any;
  reconciliationSource?: string;
  updateEvenIfSame?: boolean;
};

export class ServerRefundStatusService {
  constructor(private readonly supabase: SupabaseClient) {}

  async updateRefundByTransactionId(
    transactionId: string,
    newStatus: string,
    context: RefundUpdateContext
  ): Promise<{ refundFound: boolean; updated: boolean; newStatus: string }> {
    if (!transactionId) {
      return { refundFound: false, updated: false, newStatus };
    }

    const { data: refund, error } = await this.supabase
      .from('refunds')
      .select('id, status, refund_type, booking_id, metadata')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (error) {
      console.error('[REFUND] Error finding refund by transaction_id:', error);
      throw error;
    }

    if (!refund) {
      return { refundFound: false, updated: false, newStatus };
    }

    const result = await this.updateRefundStatus(refund, newStatus, context);
    return { refundFound: true, updated: result.updated, newStatus: result.newStatus };
  }

  async updateRefundStatus(
    refund: RefundRecord,
    newStatus: string,
    context: RefundUpdateContext
  ): Promise<{ updated: boolean; newStatus: string }> {
    const now = new Date().toISOString();
    const metadata: Record<string, any> = { ...(refund.metadata || {}) };

    if (context.providerStatus) {
      metadata.providerStatus = context.providerStatus;
    }

    if (context.callbackPayload) {
      metadata.callbackReceived = true;
      metadata.callbackReceivedAt = now;
      metadata.callbackPayload = context.callbackPayload;
    }

    if (context.reconciliationSource) {
      metadata.reconciledAt = now;
      metadata.reconciliationSource = context.reconciliationSource;
    }

    if (context.source) {
      metadata.lastUpdateSource = context.source;
    }

    const statusChanged = refund.status !== newStatus;
    const shouldUpdate = statusChanged || context.updateEvenIfSame;

    if (!shouldUpdate) {
      return { updated: false, newStatus: refund.status };
    }

    const updateData: Record<string, any> = {
      updated_at: now,
      metadata,
    };

    if (statusChanged || context.updateEvenIfSame) {
      updateData.status = newStatus;
    }

    const { error: updateError } = await this.supabase
      .from('refunds')
      .update(updateData)
      .eq('id', refund.id);

    if (updateError) {
      console.error('[REFUND] Error updating refund status:', updateError);
      throw updateError;
    }

    if (newStatus === 'completed' && refund.refund_type === 'partial' && refund.booking_id) {
      await this.restoreBookingPaymentStatus(refund.booking_id);
    }

    return { updated: true, newStatus };
  }

  private async restoreBookingPaymentStatus(bookingId: string): Promise<void> {
    try {
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select('id, status, payment_status')
        .eq('id', bookingId)
        .maybeSingle();

      if (bookingError) {
        console.error('[REFUND] Error fetching booking for partial refund:', bookingError);
        return;
      }

      if (
        booking &&
        booking.status !== 'cancelled' &&
        (booking.payment_status === 'partial' ||
          booking.payment_status === 'completed' ||
          booking.payment_status === 'partial_refund')
      ) {
        const { error: bookingUpdateError } = await this.supabase
          .from('bookings')
          .update({
            payment_status: 'partial_refund',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id);

        if (bookingUpdateError) {
          console.error('[REFUND] Error restoring booking payment_status after refund:', bookingUpdateError);
        }
      }
    } catch (error) {
      console.error('[REFUND] Error restoring booking payment_status:', error);
    }
  }
}
