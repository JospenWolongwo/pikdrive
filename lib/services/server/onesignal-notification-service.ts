import type { SupabaseClient } from '@supabase/supabase-js';

import type { NotificationRequest, NotificationResponse } from '@/types/notification';

/**
 * Server-side OneSignal Notification Service
 * 
 * SINGLE RESPONSIBILITY: Send notifications via OneSignal Edge Function
 * Clean, simple, enterprise-grade
 */
export class ServerOneSignalNotificationService {
  private edgeFunctionUrl: string;

  constructor(private supabase: SupabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-notification`;
  }

  /**
   * Send notification to a user
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResponse> {
    try {
      console.log('📤 Sending notification via Edge Function:', {
        userId: request.userId,
        title: request.title,
        type: request.notificationType,
      });

      // Get service role key for authentication
      const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        throw new Error('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY not configured');
      }

      // Call Edge Function
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send notification');
      }

      const result = await response.json();

      console.log('✅ Notification sent successfully:', {
        notificationId: result.notificationId,
        recipients: result.recipients,
      });

      return {
        success: true,
        notificationId: result.notificationId,
        recipients: result.recipients,
      };
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification',
      };
    }
  }

  /**
   * Send booking notification
   */
  async sendBookingNotification(
    userId: string,
    bookingId: string,
    type: 'created' | 'confirmed' | 'cancelled',
    rideDetails: { from: string; to: string }
  ): Promise<NotificationResponse> {
    const messages = {
      created: {
        title: '🎫 Réservation Créée',
        message: `Votre réservation pour ${rideDetails.from} → ${rideDetails.to} est en attente de paiement.`,
      },
      confirmed: {
        title: '✅ Réservation Confirmée',
        message: `Votre voyage ${rideDetails.from} → ${rideDetails.to} est confirmé! Bon voyage!`,
      },
      cancelled: {
        title: '❌ Réservation Annulée',
        message: `Votre réservation pour ${rideDetails.from} → ${rideDetails.to} a été annulée.`,
      },
    };

    const { title, message } = messages[type];

    return this.sendNotification({
      userId,
      title,
      message,
      notificationType: `booking_${type}`,
      data: {
        bookingId,
        type: `booking_${type}`,
        rideFrom: rideDetails.from,
        rideTo: rideDetails.to,
      },
    });
  }

  /**
   * Send payment notification (professional MTN MoMo style)
   */
  async sendPaymentNotification(
    userId: string,
    paymentId: string,
    type: 'pending' | 'processing' | 'completed' | 'failed',
    amount: number,
    metadata?: { provider?: string; transactionId?: string; reason?: string }
  ): Promise<NotificationResponse> {
    const provider = metadata?.provider?.toUpperCase() || 'Mobile Money';
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);

    const messages = {
      pending: {
        title: 'Payment Pending ⏳',
        message: `Please complete payment of ${formatAmount(amount)} XAF on your ${provider} phone.`,
      },
      processing: {
        title: 'Payment Processing ⏳',
        message: `Your payment of ${formatAmount(amount)} XAF via ${provider} is being processed...`,
      },
      completed: {
        title: 'Payment Successful ✅',
        message: `${formatAmount(amount)} XAF paid via ${provider}.${metadata?.transactionId ? ` Transaction ID: ${metadata.transactionId}` : ''}`,
      },
      failed: {
        title: 'Payment Failed ❌',
        message: `Payment could not be processed. ${metadata?.reason || 'Please try again.'}`,
      },
    };

    const { title, message } = messages[type];

    return this.sendNotification({
      userId,
      title,
      message,
      notificationType: `payment_${type}`,
      data: {
        paymentId,
        amount,
        provider: metadata?.provider,
        transactionId: metadata?.transactionId,
        type: `payment_${type}`,
      },
    });
  }

  /**
   * Send message notification
   */
  async sendMessageNotification(
    userId: string,
    senderId: string,
    senderName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<NotificationResponse> {
    return this.sendNotification({
      userId,
      title: `💬 Nouveau message de ${senderName}`,
      message: messagePreview,
      notificationType: 'new_message',
      data: {
        conversationId,
        senderId,
        type: 'new_message',
      },
    });
  }
}
