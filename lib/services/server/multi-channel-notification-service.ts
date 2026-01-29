import type { SupabaseClient } from '@supabase/supabase-js';
import { ServerOneSignalNotificationService } from './onesignal-notification-service';
import { ServerWhatsAppNotificationService } from './whatsapp-notification-service';
import type { NotificationRequest } from '@/types/notification';

/**
 * Server-side Multi-Channel Notification Service
 * 
 * SINGLE RESPONSIBILITY: Orchestrate notifications across multiple channels
 * Always sends OneSignal (primary), conditionally sends WhatsApp (enhancement)
 */
export class ServerMultiChannelNotificationService {
  private oneSignalService: ServerOneSignalNotificationService;
  private whatsappService: ServerWhatsAppNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.oneSignalService = new ServerOneSignalNotificationService(supabase);
    this.whatsappService = new ServerWhatsAppNotificationService(supabase);
  }

  /**
   * Check if user has WhatsApp enabled and phone number available
   */
  private async shouldSendWhatsApp(
    userId: string,
    phoneNumber?: string
  ): Promise<boolean> {
    if (!phoneNumber) {
      return false;
    }

    try {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('whatsapp_notifications_enabled, phone')
        .eq('id', userId)
        .single();

      // Default to true if not set (opt-in by default)
      const whatsappEnabled = profile?.whatsapp_notifications_enabled ?? true;
      const hasPhone = profile?.phone || phoneNumber;

      return whatsappEnabled && !!hasPhone;
    } catch (error) {
      console.error('[MULTI-CHANNEL] Error checking WhatsApp preference:', error);
      // Default to false on error to be safe
      return false;
    }
  }

  /**
   * Send payment confirmed notification (passenger)
   */
  async sendPaymentConfirmed(data: {
    readonly userId: string;
    readonly phoneNumber?: string;
    readonly passengerName: string;
    readonly route: string; // e.g., "Douala → Bafoussam"
    readonly departureTime: string;
    readonly pickupPointName?: string;
    readonly pickupTime?: string;
    readonly seats: number;
    readonly amount: number;
    readonly verificationCode: string;
    readonly bookingId: string;
    readonly paymentId: string;
    readonly rideId: string;
    readonly transactionId?: string;
  }): Promise<{ onesignal: boolean; whatsapp: boolean }> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Build OneSignal message
    let message = `Votre réservation pour ${data.route} est confirmée.\n`;
    message += `Code de vérification: ${data.verificationCode}\n`;
    message += `Montant: ${formatAmount(data.amount)} XAF • Date: ${formatDate(data.departureTime)}\n`;
    message += `Places: ${data.seats} • ${data.passengerName}\n\n`;
    if (data.pickupPointName && data.pickupTime) {
      message += `Point de ramassage: ${data.pickupPointName} à ${formatDate(data.pickupTime)}\n`;
    }
    message += `📱 Note: Présentez ce code au conducteur à l'embarquement.`;

    // Always send OneSignal
    const onesignalPromise = this.oneSignalService.sendNotification({
      userId: data.userId,
      title: '✅ Paiement Confirmé!',
      message: message,
      notificationType: 'payment_success',
      imageUrl: 'https://pikdrive.com/icons/icon-192x192.png',
      data: {
        bookingId: data.bookingId,
        rideId: data.rideId,
        paymentId: data.paymentId,
        type: 'payment_completed',
        icon: 'CheckCircle2',
        verificationCode: data.verificationCode,
        action: 'view_booking',
        deepLink: `pikdrive.com/bookings/${data.bookingId}`,
        priority: 'high',
      },
    });

    // Conditionally send WhatsApp (with fallback - OneSignal always succeeds)
    const whatsappEnabled = await this.shouldSendWhatsApp(data.userId, data.phoneNumber);
    const whatsappPromise = whatsappEnabled
      ? this.whatsappService.sendTemplateMessage({
          templateName: 'booking_confirmation',
          phoneNumber: data.phoneNumber!,
          variables: [
            data.passengerName,
            data.route,
            formatDate(data.departureTime),
            data.pickupPointName || 'Point de départ',
            data.pickupTime ? formatDate(data.pickupTime) : formatDate(data.departureTime),
            data.seats.toString(),
            formatAmount(data.amount),
            data.verificationCode,
          ],
          language: 'fr',
        }).catch(err => {
          // Non-critical: WhatsApp failure doesn't block OneSignal
          console.error('[MULTI-CHANNEL] WhatsApp send failed (non-critical, OneSignal still sent):', err);
          return { success: false, error: err.message };
        })
      : Promise.resolve({ success: false, error: 'WhatsApp not enabled or no phone' });

    // Execute both in parallel
    const [onesignalResult, whatsappResult] = await Promise.all([
      onesignalPromise,
      whatsappPromise,
    ]);

    return {
      onesignal: onesignalResult.success !== false,
      whatsapp: whatsappResult.success === true,
    };
  }

  /**
   * Send driver new booking notification
   */
  async sendDriverNewBooking(data: {
    readonly driverId: string;
    readonly driverPhone?: string;
    readonly driverName: string;
    readonly passengerName: string;
    readonly route: string;
    readonly seats: number;
    readonly amount: number;
    readonly pickupPointName?: string;
    readonly pickupTime?: string;
    readonly departureTime: string;
    readonly bookingId: string;
    readonly rideId: string;
    readonly paymentId: string;
  }): Promise<{ onesignal: boolean; whatsapp: boolean }> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Build OneSignal message
    let message = `${data.passengerName} a payé ${formatAmount(data.amount)} XAF pour votre trajet ${data.route}.\n`;
    message += `Places: ${data.seats} • Date: ${formatDate(data.departureTime)}\n`;
    if (data.pickupPointName && data.pickupTime) {
      message += `Point de ramassage: ${data.pickupPointName} à ${formatDate(data.pickupTime)}\n`;
    }
    message += `\n🔒 Note: Demandez le code de vérification au passager à l'embarquement.`;

    // Always send OneSignal
    const onesignalPromise = this.oneSignalService.sendNotification({
      userId: data.driverId,
      title: '💰 Nouvelle Réservation Payée!',
      message: message,
      notificationType: 'driver_new_booking',
      imageUrl: 'https://pikdrive.com/icons/icon-192x192.png',
      data: {
        bookingId: data.bookingId,
        rideId: data.rideId,
        paymentId: data.paymentId,
        passengerName: data.passengerName,
        amount: data.amount,
        seats: data.seats,
        fromCity: data.route.split(' → ')[0] || '',
        toCity: data.route.split(' → ')[1] || '',
        departureTime: data.departureTime,
        type: 'driver_booking_paid',
        action: 'view_driver_booking',
        deepLink: `pikdrive.com/driver/bookings/${data.bookingId}`,
        priority: 'high',
      },
    });

    // Conditionally send WhatsApp (with fallback - OneSignal always succeeds)
    const whatsappEnabled = await this.shouldSendWhatsApp(data.driverId, data.driverPhone);
    const whatsappPromise = whatsappEnabled
      ? this.whatsappService.sendTemplateMessage({
          templateName: 'driver_new_booking',
          phoneNumber: data.driverPhone!,
          variables: [
            data.driverName,
            data.passengerName,
            data.route,
            data.seats.toString(),
            formatAmount(data.amount),
            data.pickupPointName || 'Point de départ',
            data.pickupTime ? formatDate(data.pickupTime) : formatDate(data.departureTime),
          ],
          language: 'fr',
        }).catch(err => {
          // Non-critical: WhatsApp failure doesn't block OneSignal
          console.error('[MULTI-CHANNEL] WhatsApp send failed (non-critical, OneSignal still sent):', err);
          return { success: false, error: err.message };
        })
      : Promise.resolve({ success: false, error: 'WhatsApp not enabled or no phone' });

    // Execute both in parallel
    const [onesignalResult, whatsappResult] = await Promise.all([
      onesignalPromise,
      whatsappPromise,
    ]);

    return {
      onesignal: onesignalResult.success !== false,
      whatsapp: whatsappResult.success === true,
    };
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailed(data: {
    readonly userId: string;
    readonly phoneNumber?: string;
    readonly passengerName: string;
    readonly amount: number;
    readonly reason: string;
    readonly retryLink?: string;
    readonly paymentId: string;
  }): Promise<{ onesignal: boolean; whatsapp: boolean }> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);
    const retryUrl = data.retryLink || `pikdrive.com/payments/retry/${data.paymentId}`;

    // Build OneSignal message
    let message = `Le paiement de ${formatAmount(data.amount)} XAF a échoué.\n`;
    message += `Raison: ${data.reason}\n\n`;
    message += `Réessayez: ${retryUrl}`;

    // Always send OneSignal
    const onesignalPromise = this.oneSignalService.sendNotification({
      userId: data.userId,
      title: '❌ Paiement Échoué',
      message: message,
      notificationType: 'payment_failed',
      imageUrl: 'https://pikdrive.com/icons/icon-192x192.png',
      data: {
        paymentId: data.paymentId,
        type: 'payment_failed',
        icon: 'XCircle',
        action: 'retry_payment',
        deepLink: retryUrl,
        priority: 'high',
      },
    });

    // Conditionally send WhatsApp
    const whatsappEnabled = await this.shouldSendWhatsApp(data.userId, data.phoneNumber);
    const whatsappPromise = whatsappEnabled
      ? this.whatsappService.sendTemplateMessage({
          templateName: 'payment_failed',
          phoneNumber: data.phoneNumber!,
          variables: [
            data.passengerName,
            formatAmount(data.amount),
            data.reason,
            retryUrl,
          ],
          language: 'fr',
        }).catch(err => {
          console.error('[MULTI-CHANNEL] WhatsApp send failed (non-critical):', err);
          return { success: false, error: err.message };
        })
      : Promise.resolve({ success: false, error: 'WhatsApp not enabled or no phone' });

    // Execute both in parallel
    const [onesignalResult, whatsappResult] = await Promise.all([
      onesignalPromise,
      whatsappPromise,
    ]);

    return {
      onesignal: onesignalResult.success !== false,
      whatsapp: whatsappResult.success === true,
    };
  }

  /**
   * Send ride reminder notification
   */
  async sendRideReminder(data: {
    readonly userId: string;
    readonly phoneNumber?: string;
    readonly userName: string;
    readonly route: string;
    readonly departureTime: string;
    readonly pickupPointName?: string;
    readonly pickupTime?: string;
    readonly bookingId: string;
  }): Promise<{ onesignal: boolean; whatsapp: boolean }> {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Build OneSignal message
    let message = `📅 Rappel: Votre trajet demain\n\n`;
    message += `Trajet: ${data.route}\n`;
    message += `Départ: ${formatDate(data.departureTime)}\n`;
    if (data.pickupPointName && data.pickupTime) {
      message += `Point de ramassage: ${data.pickupPointName} à ${formatDate(data.pickupTime)}\n`;
    }
    message += `\nSoyez à l'heure! 🚗`;

    // Always send OneSignal
    const onesignalPromise = this.oneSignalService.sendNotification({
      userId: data.userId,
      title: '📅 Rappel de Trajet',
      message: message,
      notificationType: 'ride_reminder',
      imageUrl: 'https://pikdrive.com/icons/icon-192x192.png',
      data: {
        bookingId: data.bookingId,
        type: 'ride_reminder',
        action: 'view_booking',
        deepLink: `pikdrive.com/bookings/${data.bookingId}`,
        priority: 'medium',
      },
    });

    // Conditionally send WhatsApp
    const whatsappEnabled = await this.shouldSendWhatsApp(data.userId, data.phoneNumber);
    const whatsappPromise = whatsappEnabled
      ? this.whatsappService.sendTemplateMessage({
          templateName: 'ride_reminder',
          phoneNumber: data.phoneNumber!,
          variables: [
            data.userName,
            data.route,
            formatDate(data.departureTime),
            data.pickupPointName || 'Point de départ',
            data.pickupTime ? formatDate(data.pickupTime) : formatDate(data.departureTime),
          ],
          language: 'fr',
        }).catch(err => {
          console.error('[MULTI-CHANNEL] WhatsApp send failed (non-critical):', err);
          return { success: false, error: err.message };
        })
      : Promise.resolve({ success: false, error: 'WhatsApp not enabled or no phone' });

    // Execute both in parallel
    const [onesignalResult, whatsappResult] = await Promise.all([
      onesignalPromise,
      whatsappPromise,
    ]);

    return {
      onesignal: onesignalResult.success !== false,
      whatsapp: whatsappResult.success === true,
    };
  }

  /**
   * Send pickup point update notification
   */
  async sendPickupPointUpdate(data: {
    readonly passengerId: string;
    readonly phoneNumber?: string;
    readonly passengerName: string;
    readonly driverName: string;
    readonly currentPickupPoint: string;
    readonly estimatedArrival: string; // e.g., "10 minutes"
    readonly route: string;
    readonly bookingId: string;
  }): Promise<{ onesignal: boolean; whatsapp: boolean }> {
    // Build OneSignal message
    let message = `📍 Mise à jour du ramassage\n\n`;
    message += `Le conducteur ${data.driverName} est en route vers ${data.currentPickupPoint}.\n`;
    message += `Arrivée prévue: ${data.estimatedArrival}\n\n`;
    message += `Trajet: ${data.route}`;

    // Always send OneSignal
    const onesignalPromise = this.oneSignalService.sendNotification({
      userId: data.passengerId,
      title: '📍 Mise à jour du Ramassage',
      message: message,
      notificationType: 'pickup_point_update',
      imageUrl: 'https://pikdrive.com/icons/icon-192x192.png',
      data: {
        bookingId: data.bookingId,
        type: 'pickup_point_update',
        action: 'view_booking',
        deepLink: `pikdrive.com/bookings/${data.bookingId}`,
        priority: 'high',
      },
    });

    // Conditionally send WhatsApp
    const whatsappEnabled = await this.shouldSendWhatsApp(data.passengerId, data.phoneNumber);
    const whatsappPromise = whatsappEnabled
      ? this.whatsappService.sendTemplateMessage({
          templateName: 'pickup_point_update',
          phoneNumber: data.phoneNumber!,
          variables: [
            data.passengerName,
            data.driverName,
            data.currentPickupPoint,
            data.estimatedArrival,
            data.route,
          ],
          language: 'fr',
        }).catch(err => {
          console.error('[MULTI-CHANNEL] WhatsApp send failed (non-critical):', err);
          return { success: false, error: err.message };
        })
      : Promise.resolve({ success: false, error: 'WhatsApp not enabled or no phone' });

    // Execute both in parallel
    const [onesignalResult, whatsappResult] = await Promise.all([
      onesignalPromise,
      whatsappPromise,
    ]);

    return {
      onesignal: onesignalResult.success !== false,
      whatsapp: whatsappResult.success === true,
    };
  }

  /**
   * Send booking cancelled notification
   */
  async sendBookingCancelled(data: {
    readonly userId: string;
    readonly phoneNumber?: string;
    readonly userName: string;
    readonly route: string;
    readonly refundAmount?: number;
    readonly refundStatus?: string;
    readonly bookingId: string;
  }): Promise<{ onesignal: boolean; whatsapp: boolean }> {
    const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);

    // Build OneSignal message
    let message = `🚫 Réservation annulée\n\n`;
    message += `Trajet: ${data.route}\n`;
    if (data.refundAmount) {
      message += `Remboursement: ${formatAmount(data.refundAmount)} XAF\n`;
      if (data.refundStatus) {
        message += `Statut: ${data.refundStatus}\n`;
      }
    }

    // Always send OneSignal
    const onesignalPromise = this.oneSignalService.sendNotification({
      userId: data.userId,
      title: '🚫 Réservation Annulée',
      message: message,
      notificationType: 'booking_cancelled',
      imageUrl: 'https://pikdrive.com/icons/icon-192x192.png',
      data: {
        bookingId: data.bookingId,
        type: 'booking_cancelled',
        action: 'view_booking',
        deepLink: `pikdrive.com/bookings/${data.bookingId}`,
        priority: 'medium',
      },
    });

    // Conditionally send WhatsApp
    const whatsappEnabled = await this.shouldSendWhatsApp(data.userId, data.phoneNumber);
    const whatsappPromise = whatsappEnabled
      ? this.whatsappService.sendTemplateMessage({
          templateName: 'booking_cancelled',
          phoneNumber: data.phoneNumber!,
          variables: [
            data.userName,
            data.route,
            data.refundAmount ? formatAmount(data.refundAmount) : '0',
            data.refundStatus || 'En attente',
          ],
          language: 'fr',
        }).catch(err => {
          console.error('[MULTI-CHANNEL] WhatsApp send failed (non-critical):', err);
          return { success: false, error: err.message };
        })
      : Promise.resolve({ success: false, error: 'WhatsApp not enabled or no phone' });

    // Execute both in parallel
    const [onesignalResult, whatsappResult] = await Promise.all([
      onesignalPromise,
      whatsappPromise,
    ]);

    return {
      onesignal: onesignalResult.success !== false,
      whatsapp: whatsappResult.success === true,
    };
  }
}
