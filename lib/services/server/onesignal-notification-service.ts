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
    console.log('🔧 OneSignal Edge Function URL configured:', this.edgeFunctionUrl);
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
      console.log('🌐 Calling OneSignal Edge Function:', this.edgeFunctionUrl);
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(request),
      });

      console.log('📡 OneSignal Edge Function response status:', response.status);

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
        title: 'Booking Created',
        message: `Your booking for ${rideDetails.from} to ${rideDetails.to} is pending payment.`,
        icon: 'Ticket', // Lucide icon
      },
      confirmed: {
        title: 'Booking Confirmed',
        message: `Your trip from ${rideDetails.from} to ${rideDetails.to} is confirmed. Have a safe journey!`,
        icon: 'TicketCheck', // Lucide icon
      },
      cancelled: {
        title: 'Booking Cancelled',
        message: `Your booking for ${rideDetails.from} to ${rideDetails.to} has been cancelled.`,
        icon: 'TicketX', // Lucide icon
      },
    };

    const { title, message, icon } = messages[type];

    return this.sendNotification({
      userId,
      title,
      message,
      notificationType: `booking_${type}`,
      data: {
        bookingId,
        type: `booking_${type}`,
        icon, // Lucide icon name
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
        title: 'Payment Pending',
        message: `Please complete payment of ${formatAmount(amount)} XAF on your ${provider} phone.`,
        icon: 'Clock', // Lucide icon
      },
      processing: {
        title: 'Payment Processing',
        message: `Your payment of ${formatAmount(amount)} XAF via ${provider} is being processed...`,
        icon: 'Loader2', // Lucide icon
      },
      completed: {
        title: 'Payment Successful',
        message: `${formatAmount(amount)} XAF paid via ${provider}.${metadata?.transactionId ? ` Transaction ID: ${metadata.transactionId}` : ''}`,
        icon: 'CheckCircle2', // Lucide icon
      },
      failed: {
        title: 'Payment Failed',
        message: `Payment could not be processed. ${metadata?.reason || 'Please try again.'}`,
        icon: 'XCircle', // Lucide icon
      },
    };

    const { title, message, icon } = messages[type];

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
        icon, // Lucide icon name
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
      title: `New message from ${senderName}`,
      message: messagePreview,
      notificationType: 'new_message',
      data: {
        conversationId,
        senderId,
        type: 'new_message',
        icon: 'MessageSquare', // Lucide icon
      },
    });
  }
}
