import type { PaymentTransactionStatus } from '@/types/payment';
import { MtnMomoStatus, OrangeMoneyStatus, PawaPayStatus } from '@/types/payment-ext';

/**
 * Maps MTN MOMO provider status to internal PaymentTransactionStatus
 */
export function mapMtnMomoStatus(
  providerStatus: string
): PaymentTransactionStatus {
  switch (providerStatus) {
    case MtnMomoStatus.SUCCESSFUL:
      return 'completed';
    case MtnMomoStatus.FAILED:
      return 'failed';
    case MtnMomoStatus.PENDING:
      return 'processing'; // MOMO PENDING means payment is being processed by provider
    default:
      console.warn('Unknown MTN MOMO status:', providerStatus);
      return 'pending';
  }
}

/**
 * Maps Orange Money provider status to internal PaymentTransactionStatus
 */
export function mapOrangeMoneyStatus(
  providerStatus: string
): PaymentTransactionStatus {
  switch (providerStatus) {
    case OrangeMoneyStatus.SUCCESSFUL:
    case OrangeMoneyStatus.SUCCESSFULL: // Handle typo
      return 'completed';
    case OrangeMoneyStatus.FAILED:
    case OrangeMoneyStatus.FAIL: // Handle variation
      return 'failed';
    case OrangeMoneyStatus.PENDING:
      return 'pending';
    default:
      console.warn('Unknown Orange Money status:', providerStatus);
      return 'pending';
  }
}

/**
 * Maps pawaPay provider status to internal PaymentTransactionStatus
 */
export function mapPawaPayStatus(
  providerStatus: string
): PaymentTransactionStatus {
  const upperStatus = providerStatus.toUpperCase() as PawaPayStatus;

  switch (upperStatus) {
    case PawaPayStatus.COMPLETED:
    case PawaPayStatus.SUCCESSFUL:
      return 'completed';
    case PawaPayStatus.REJECTED:
    case PawaPayStatus.FAILED:
    case PawaPayStatus.FAILURE:
      return 'failed';
    case PawaPayStatus.ACCEPTED:
    case PawaPayStatus.SUBMITTED:
    case PawaPayStatus.PROCESSING:
    case PawaPayStatus.ENQUEUED:
    case PawaPayStatus.FOUND:
    case PawaPayStatus.NOT_FOUND:
      return 'processing';
    case PawaPayStatus.PENDING:
      return 'pending';
    default:
      console.warn('Unknown pawaPay status:', providerStatus);
      return 'pending';
  }
}

