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
    console.log('[ONESIGNAL] Edge Function URL configured:', this.edgeFunctionUrl);
  }

  /**
   * Send notification to a user
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResponse> {
    try {
      console.log('[ONESIGNAL] Calling Edge Function:', {
        url: this.edgeFunctionUrl,
        userId: request.userId,
        sendSMS: request.sendSMS,
        phoneNumber: request.phoneNumber,
        title: request.title,
        messagePreview: request.message.substring(0, 50)
      });

      // Get service role key for authentication (server-only, never exposed to client)
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        console.error('[ONESIGNAL] SUPABASE_SERVICE_ROLE_KEY not configured');
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
      }

      // Call Edge Function
      console.log('[ONESIGNAL] Sending notification via Edge Function');
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey, // Required by Supabase Edge Functions
        },
        body: JSON.stringify(request),
      });

      console.log('[ONESIGNAL] Edge Function response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('[ONESIGNAL] Edge Function error response:', error);
        throw new Error(error.error || 'Failed to send notification');
      }

      const result = await response.json();

      // Extract notification data from Edge Function response
      const pushNotification = result.pushNotification || {};
      const notificationId = pushNotification.id;
      const recipients = pushNotification.recipients;

      console.log('[ONESIGNAL] Edge Function response:', {
        success: true,
        notificationId,
        recipients,
        smsEnabled: request.sendSMS,
        phoneNumber: request.phoneNumber
      });

      return {
        success: true,
        notificationId,
        recipients,
      };
    } catch (error) {
      console.error('[ONESIGNAL] Detailed error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        request: {
          userId: request.userId,
          sendSMS: request.sendSMS,
          phoneNumber: request.phoneNumber
        }
      });
      
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
        title: 'Réservation créée',
        message: `Votre réservation de ${rideDetails.from} à ${rideDetails.to} est en attente de paiement.`,
        icon: 'Ticket', // Lucide icon
      },
      confirmed: {
        title: 'Réservation confirmée',
        message: `Votre trajet de ${rideDetails.from} à ${rideDetails.to} est confirmé. Bon voyage !`,
        icon: 'TicketCheck', // Lucide icon
      },
      cancelled: {
        title: 'Réservation annulée',
        message: `Votre réservation de ${rideDetails.from} à ${rideDetails.to} a été annulée.`,
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
        title: 'Paiement en attente',
        message: `Veuillez compléter le paiement de ${formatAmount(amount)} XAF sur votre téléphone ${provider}.`,
        icon: 'Clock', // Lucide icon
      },
      processing: {
        title: 'Paiement en cours',
        message: `Votre paiement de ${formatAmount(amount)} XAF via ${provider} est en cours de traitement...`,
        icon: 'Loader2', // Lucide icon
      },
      completed: {
        title: 'Paiement réussi',
        message: `${formatAmount(amount)} XAF payé via ${provider}.${metadata?.transactionId ? ` Transaction ID: ${metadata.transactionId}` : ''}`,
        icon: 'CheckCircle2', // Lucide icon
      },
      failed: {
        title: 'Paiement échoué',
        message: `Le paiement n'a pas pu être traité. ${metadata?.reason || 'Veuillez réessayer.'}`,
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
    conversationId: string,
    rideId?: string
  ): Promise<NotificationResponse> {
    return this.sendNotification({
      userId,
      title: `Nouveau message de ${senderName}`,
      message: messagePreview,
      notificationType: 'new_message',
      data: {
        conversationId,
        senderId,
        rideId, // Include rideId for navigation
        type: 'new_message',
        icon: 'MessageSquare', // Lucide icon
      },
    });
  }

  /**
   * Send driver notification for ride updates
   */
  async sendDriverNotification(
    driverId: string,
    type: 'new_booking' | 'booking_cancelled',
    bookingDetails: {
      id: string;
      rideId: string;
      passengerName: string;
      from: string;
      to: string;
      date: string;
      seats: number;
      amount: number;
    }
  ): Promise<NotificationResponse> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);

    const messages = {
      new_booking: {
        title: 'Nouvelle réservation!',
        message: `${bookingDetails.passengerName} a réservé votre trajet ${bookingDetails.from} → ${bookingDetails.to}`,
        icon: 'UserPlus',
      },
      booking_cancelled: {
        title: 'Réservation annulée',
        message: `${bookingDetails.passengerName} a annulé sa réservation pour ${bookingDetails.from} → ${bookingDetails.to}`,
        icon: 'UserMinus',
      },
    };

    const { title, message, icon } = messages[type];

    return this.sendNotification({
      userId: driverId,
      title,
      message,
      notificationType: `driver_${type}`,
      data: {
        bookingId: bookingDetails.id,
        rideId: bookingDetails.rideId,
        passengerName: bookingDetails.passengerName,
        from: bookingDetails.from,
        to: bookingDetails.to,
        date: bookingDetails.date,
        seats: bookingDetails.seats,
        amount: bookingDetails.amount,
        type: `driver_${type}`,
        icon,
      },
    });
  }

  /**
   * Send SMS for booking confirmation (via OneSignal SMS API)
   */
  async sendBookingConfirmationSMS(
    userId: string,
    booking: {
      id: string;
      from: string;
      to: string;
      date: string;
      amount: number;
    },
    activationCode: string,
    phoneNumber: string
  ): Promise<NotificationResponse> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR');

    const message = `Réservation confirmée!
Trajet: ${booking.from} → ${booking.to}
Date: ${formatDate(booking.date)}
Code d'activation: ${activationCode}
Montant: ${formatAmount(booking.amount)} XAF

Présentez ce code au conducteur.
Détails: pikdrive.com/bookings/${booking.id}`;

    return this.sendNotification({
      userId: userId, // Use actual user ID for OneSignal lookup
      title: 'Réservation PikDrive',
      message,
      notificationType: 'booking_confirmation_sms',
      phoneNumber, // Phone number for SMS delivery
      sendSMS: true,
      data: {
        bookingId: booking.id,
        activationCode,
        type: 'booking_confirmation_sms',
      },
    });
  }

  /**
   * Send SMS for payment failure (via OneSignal SMS API)
   */
  async sendPaymentFailureSMS(
    phoneNumber: string,
    booking: {
      id: string;
      from: string;
      to: string;
      amount: number;
      paymentId: string;
    },
    reason: string
  ): Promise<NotificationResponse> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);

    const message = `Paiement échoué
Trajet: ${booking.from} → ${booking.to}
Montant: ${formatAmount(booking.amount)} XAF
Raison: ${reason}

Réessayer: pikdrive.com/payments/retry/${booking.paymentId}
Besoin d'aide? Contactez-nous`;

    return this.sendNotification({
      userId: phoneNumber, // Use phone as user ID for SMS
      title: 'Paiement PikDrive',
      message,
      notificationType: 'payment_failure_sms',
      phoneNumber,
      sendSMS: true,
      data: {
        bookingId: booking.id,
        paymentId: booking.paymentId,
        reason,
        type: 'payment_failure_sms',
      },
    });
  }

  /**
   * Send SMS for booking cancellation confirmation
   */
  async sendCancellationConfirmationSMS(
    phoneNumber: string,
    booking: {
      id: string;
      from: string;
      to: string;
      amount: number;
    }
  ): Promise<NotificationResponse> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);

    const message = `Réservation annulée
Trajet: ${booking.from} → ${booking.to}
Montant: ${formatAmount(booking.amount)} XAF

Remboursement en cours...
Détails: pikdrive.com/bookings/${booking.id}`;

    return this.sendNotification({
      userId: phoneNumber,
      title: 'Annulation PikDrive',
      message,
      notificationType: 'cancellation_confirmation_sms',
      phoneNumber,
      sendSMS: true,
      data: {
        bookingId: booking.id,
        type: 'cancellation_confirmation_sms',
      },
    });
  }
}
