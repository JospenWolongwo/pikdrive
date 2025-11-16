/**
 * Retry Logic for Payment Operations
 * Categorizes provider errors into retryable (temporary) vs permanent failures
 */

// Retryable errors - temporary failures that may succeed on retry
export const RETRYABLE_ERRORS = [
  'PENDING',
  'ONGOING',
  'DELAYED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_PROCESSING_ERROR',
  'INTERNAL_ERROR',
];

// Permanent errors - should NOT retry, transaction will not succeed
export const PERMANENT_ERRORS = [
  'FAILED',
  'REJECTED',
  'EXPIRED',
  'NOT_ENOUGH_FUNDS',
  'PAYEE_NOT_ALLOWED_TO_RECEIVE',
  'PAYER_NOT_ALLOWED',
  'NOT_ALLOWED',
  'INVALID_CURRENCY',
  'INVALID_CALLBACK_URL_HOST',
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_HOLDER_NOT_FOUND',
  'ZERO_BALANCE',
  'NEGATIVE_BALANCE',
  'NOT_ALLOWED_TARGET_ENVIRONMENT',
  'RESOURCE_NOT_FOUND',
];

/**
 * Determine if a transaction should be retried based on status and reason
 * @param status Transaction status from provider
 * @param reason Optional error reason/message from provider
 * @returns true if transaction should be retried, false if permanent failure
 */
export function shouldRetry(status: string, reason?: string): boolean {
  const statusUpper = status.toUpperCase();
  
  // Check if status is in retryable errors
  if (RETRYABLE_ERRORS.includes(statusUpper)) {
    return true;
  }
  
  // Check if status is in permanent errors
  if (PERMANENT_ERRORS.includes(statusUpper)) {
    return false;
  }
  
  // Check reason string for retryable error keywords
  if (reason) {
    const reasonUpper = reason.toUpperCase();
    if (RETRYABLE_ERRORS.some(err => reasonUpper.includes(err))) {
      return true;
    }
    if (PERMANENT_ERRORS.some(err => reasonUpper.includes(err))) {
      return false;
    }
  }
  
  // Default: don't retry unknown statuses
  return false;
}

/**
 * Check if error is a permanent failure (should not retry)
 * @param status Transaction status from provider
 * @param reason Optional error reason/message from provider
 * @returns true if error is permanent, false if retryable or unknown
 */
export function isPermanentFailure(status: string, reason?: string): boolean {
  return !shouldRetry(status, reason);
}

/**
 * Map MTN status to our internal status
 * @param mtnStatus Status from MTN API
 * @returns Internal status string
 */
export function mapMtnPayoutStatus(mtnStatus: string): 'pending' | 'processing' | 'completed' | 'failed' {
  const statusUpper = mtnStatus.toUpperCase();
  
  if (statusUpper === 'SUCCESSFUL' || statusUpper === 'SUCCESS') {
    return 'completed';
  }
  
  if (statusUpper === 'FAILED' || statusUpper === 'REJECTED' || statusUpper === 'EXPIRED') {
    return 'failed';
  }
  
  if (statusUpper === 'PENDING' || statusUpper === 'ONGOING' || statusUpper === 'DELAYED') {
    return 'processing';
  }
  
  // Default to pending for unknown statuses
  return 'pending';
}

