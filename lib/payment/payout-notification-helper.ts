/**
 * Payout Notification Helper
 * Ensures only ONE notification is sent per payout status change
 * Tracks notification status in payout metadata to prevent duplicates
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ServerOneSignalNotificationService } from '@/lib/services/server/onesignal-notification-service';

type NotificationSource = 'callback' | 'cron' | 'status-check' | 'initial';
type NotificationStatus = 'failed' | 'completed';

interface PayoutMetadata {
  notificationSent?: {
    failed?: boolean;
    completed?: boolean;
    failedAt?: string;
    completedAt?: string;
    failedBy?: NotificationSource;
    completedBy?: NotificationSource;
  };
  [key: string]: any;
}

interface PayoutRecord {
  id: string;
  driver_id: string;
  amount: number | string;
  currency: string;
  booking_id?: string;
  transaction_id?: string;
  metadata?: PayoutMetadata;
}

/**
 * Check if notification has already been sent for a payout status
 */
function hasNotificationBeenSent(
  metadata: PayoutMetadata | undefined,
  status: NotificationStatus
): boolean {
  if (!metadata?.notificationSent) {
    return false;
  }

  if (status === 'failed') {
    return metadata.notificationSent.failed === true;
  }

  if (status === 'completed') {
    return metadata.notificationSent.completed === true;
  }

  return false;
}

/**
 * Send payout notification if not already sent
 * Returns true if notification was sent, false if skipped (already sent)
 */
export async function sendPayoutNotificationIfNeeded(
  supabase: SupabaseClient,
  payout: PayoutRecord,
  status: NotificationStatus,
  reason?: string,
  source: NotificationSource = 'callback'
): Promise<boolean> {
  // Check if notification already sent
  if (hasNotificationBeenSent(payout.metadata, status)) {
    console.log(`⏭️ [NOTIFICATION] Skipping ${status} notification for payout ${payout.id} - already sent`, {
      payoutId: payout.id,
      status,
      previouslySentBy: payout.metadata?.notificationSent?.[status === 'failed' ? 'failedBy' : 'completedBy'],
    });
    return false;
  }

  if (!payout.driver_id) {
    console.warn(`⚠️ [NOTIFICATION] Cannot send ${status} notification - no driver_id`, {
      payoutId: payout.id,
    });
    return false;
  }

  try {
    const notificationService = new ServerOneSignalNotificationService(supabase);

    const formatAmount = (amt: number) => {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: payout.currency || 'XAF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amt);
    };

    if (status === 'failed') {
      const errorReason = reason || 'Raison inconnue';
      const amount = typeof payout.amount === 'string' 
        ? parseFloat(payout.amount) 
        : payout.amount;

      await notificationService.sendNotification({
        userId: payout.driver_id,
        title: '⚠️ Échec du Paiement',
        message: `Le transfert de ${formatAmount(amount)} ${payout.currency || 'XAF'} a échoué.\n\nRaison: ${errorReason}\n\nVeuillez contacter le support si le problème persiste.`,
        notificationType: 'payout_failed',
        imageUrl: '/icons/payment-failed.svg',
        sendSMS: false,
        data: {
          payoutId: payout.id,
          bookingId: payout.booking_id,
          amount: payout.amount,
          currency: payout.currency,
          transactionId: payout.transaction_id,
          errorReason: errorReason,
          type: 'payout_failed',
          action: 'contact_support',
          deepLink: '/driver/dashboard?tab=payments',
          priority: 'high',
        },
      });

      // Update metadata to mark notification as sent
      const updatedMetadata: PayoutMetadata = {
        ...(payout.metadata || {}),
        notificationSent: {
          ...(payout.metadata?.notificationSent || {}),
          failed: true,
          failedAt: new Date().toISOString(),
          failedBy: source,
        },
      };

      await supabase
        .from('payouts')
        .update({
          metadata: updatedMetadata,
        })
        .eq('id', payout.id);

      console.log(`✅ [NOTIFICATION] ${status} notification sent for payout ${payout.id}`, {
        payoutId: payout.id,
        driverId: payout.driver_id,
        amount,
        source,
        reason: errorReason,
      });

      return true;
    }

    if (status === 'completed') {
      const amount = typeof payout.amount === 'string' 
        ? parseFloat(payout.amount) 
        : payout.amount;

      await notificationService.sendNotification({
        userId: payout.driver_id,
        title: '💰 Paiement Reçu!',
        message: `Votre paiement de ${formatAmount(amount)} ${payout.currency || 'XAF'} a été transféré avec succès sur votre compte mobile.`,
        notificationType: 'payout_completed',
        imageUrl: '/icons/payment-received.svg',
        sendSMS: false,
        data: {
          payoutId: payout.id,
          bookingId: payout.booking_id,
          amount: payout.amount,
          currency: payout.currency,
          transactionId: payout.transaction_id,
          type: 'payout_completed',
          action: 'view_payments',
          deepLink: '/driver/dashboard?tab=payments',
          priority: 'high',
        },
      });

      // Update metadata to mark notification as sent
      const updatedMetadata: PayoutMetadata = {
        ...(payout.metadata || {}),
        notificationSent: {
          ...(payout.metadata?.notificationSent || {}),
          completed: true,
          completedAt: new Date().toISOString(),
          completedBy: source,
        },
      };

      await supabase
        .from('payouts')
        .update({
          metadata: updatedMetadata,
        })
        .eq('id', payout.id);

      console.log(`✅ [NOTIFICATION] ${status} notification sent for payout ${payout.id}`, {
        payoutId: payout.id,
        driverId: payout.driver_id,
        amount,
        source,
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ [NOTIFICATION] Error sending ${status} notification for payout ${payout.id}:`, error);
    // Don't throw - notifications are non-critical
    return false;
  }
}

