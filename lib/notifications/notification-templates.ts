// Professional notification message templates
// Inspired by Uber, DoorDash, and MTN MoMo best practices

import type { NotificationType, NotificationData } from '@/types/notification';

/**
 * Generate notification title based on type and data
 */
export function getNotificationTitle(
  type: NotificationType,
  data?: NotificationData
): string {
  switch (type) {
    case 'booking_confirmed':
      return 'Booking Confirmed!';
    
    case 'booking_cancelled':
      return 'Booking Cancelled';
    
    case 'booking_updated':
      return 'Booking Updated';
    
    case 'payment_pending':
      return 'Payment Pending';
    
    case 'payment_processing':
      return 'Processing Payment';
    
    case 'payment_success':
      return 'Payment Successful';
    
    case 'payment_failed':
      return 'Payment Failed';
    
    case 'new_message':
      return 'New Message';
    
    case 'driver_arriving':
      return 'Driver Arriving';
    
    case 'driver_arrived':
      return 'Driver Arrived';
    
    case 'ride_started':
      return 'Ride Started';
    
    case 'ride_completed':
      return 'Ride Completed';
    
    case 'ride_cancelled':
      return 'Ride Cancelled';
    
    case 'announcement':
      return 'Important Announcement';
    
    default:
      return 'PikDrive Notification';
  }
}

/**
 * Generate notification message based on type and data
 */
export function getNotificationMessage(
  type: NotificationType,
  data?: NotificationData
): string {
  switch (type) {
    case 'booking_confirmed':
      return `Your booking from ${data?.origin || 'your location'} to ${data?.destination || 'destination'} has been confirmed!`;
    
    case 'booking_cancelled':
      return `Your booking from ${data?.origin || 'your location'} to ${data?.destination || 'destination'} has been cancelled.`;
    
    case 'booking_updated':
      return `Your booking has been updated. Check details in the app.`;
    
    case 'payment_pending':
      return `Payment of ${data?.amount ? `${data.amount} XAF` : 'your amount'} is pending. Please complete payment to confirm your booking.`;
    
    case 'payment_processing':
      return `Payment of ${data?.amount ? `${data.amount} XAF` : 'your amount'} via ${data?.provider?.toUpperCase() || 'MoMo'} is being processed. Please wait...`;
    
    case 'payment_success':
      return `Payment of ${data?.amount ? `${data.amount} XAF` : 'your amount'} successful! Your booking is confirmed. Transaction ID: ${data?.transactionId?.slice(-8) || 'N/A'}`;
    
    case 'payment_failed':
      return `Payment of ${data?.amount ? `${data.amount} XAF` : 'your amount'} failed. Please try again or use a different payment method.`;
    
    case 'new_message':
      return `You have a new message from ${data?.senderName || 'your driver'}. Tap to view.`;
    
    case 'driver_arriving':
      return `Your driver is arriving at your pickup location. Please be ready!`;
    
    case 'driver_arrived':
      return `Your driver has arrived at your pickup location. Please meet them now.`;
    
    case 'ride_started':
      return `Your ride has started! Enjoy your journey from ${data?.origin || 'pickup'} to ${data?.destination || 'destination'}.`;
    
    case 'ride_completed':
      return `Your ride has been completed! Thank you for choosing PikDrive. Rate your experience.`;
    
    case 'ride_cancelled':
      return `Your ride has been cancelled. We apologize for any inconvenience.`;
    
    case 'announcement':
      return data?.message || 'You have an important announcement from PikDrive. Tap to view.';
    
    default:
      return 'You have a notification from PikDrive.';
  }
}

/**
 * Generate MTN MoMo style payment messages (professional fintech style)
 */
export function getMoMoPaymentMessage(
  status: 'processing' | 'completed' | 'failed',
  amount: number,
  transactionId?: string,
  provider: 'mtn' | 'orange' = 'mtn'
): string {
  const providerName = provider.toUpperCase();
  
  switch (status) {
    case 'processing':
      return `${providerName} MoMo: Processing payment of ${amount} XAF. Please wait...`;
    
    case 'completed':
      return `${providerName} MoMo: Payment of ${amount} XAF successful! Txn ID: ${transactionId?.slice(-8) || 'N/A'}`;
    
    case 'failed':
      return `${providerName} MoMo: Payment of ${amount} XAF failed. Please try again.`;
    
    default:
      return `${providerName} MoMo: Payment notification`;
  }
}

/**
 * Generate Uber-style ride status messages
 */
export function getRideStatusMessage(
  status: 'driver_assigned' | 'driver_arriving' | 'driver_arrived' | 'ride_started' | 'ride_completed',
  data?: NotificationData
): string {
  switch (status) {
    case 'driver_assigned':
      return `Your driver ${data?.driverName || 'has been assigned'}. They'll contact you soon.`;
    
    case 'driver_arriving':
      return `Your driver is arriving at your pickup location. Please be ready!`;
    
    case 'driver_arrived':
      return `Your driver has arrived! Please meet them at the pickup point.`;
    
    case 'ride_started':
      return `Your ride has started! Enjoy your journey to ${data?.destination || 'your destination'}.`;
    
    case 'ride_completed':
      return `Ride completed! Thank you for choosing PikDrive. How was your experience?`;
    
    default:
      return 'Ride status update from PikDrive.';
  }
}
