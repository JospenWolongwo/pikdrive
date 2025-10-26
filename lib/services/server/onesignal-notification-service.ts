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
          'apikey': serviceRoleKey, // Required by Supabase Edge Functions
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
        title: '🎉 Nouvelle réservation!',
        message: `${bookingDetails.passengerName} a réservé votre trajet ${bookingDetails.from} → ${bookingDetails.to}`,
        icon: 'UserPlus',
      },
      booking_cancelled: {
        title: '⚠️ Réservation annulée',
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
    phoneNumber: string,
    booking: {
      id: string;
      from: string;
      to: string;
      date: string;
      amount: number;
    },
    activationCode: string
  ): Promise<NotificationResponse> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR');

    const message = `✅ Réservation confirmée!
Trajet: ${booking.from} → ${booking.to}
Date: ${formatDate(booking.date)}
Code d'activation: ${activationCode}
Montant: ${formatAmount(booking.amount)} XAF

Présentez ce code au conducteur.
Détails: pikdrive.com/bookings/${booking.id}`;

    return this.sendNotification({
      userId: phoneNumber, // Use phone as user ID for SMS
      title: 'Réservation PikDrive',
      message,
      notificationType: 'booking_confirmation_sms',
      phoneNumber,
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

    const message = `❌ Paiement échoué
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

    const message = `✅ Réservation annulée
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
