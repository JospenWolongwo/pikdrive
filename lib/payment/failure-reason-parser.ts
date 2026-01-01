/**
 * Parses pawaPay failure reasons and converts them to user-friendly messages
 */

interface FailureReason {
  failureMessage?: string;
  failureCode?: string;
}

/**
 * Parse failure reason from pawaPay API response
 * @param failureReason - The failureReason object from pawaPay API (can be string, object, or undefined)
 * @returns User-friendly error message in French
 */
export function parseFailureReason(failureReason: unknown): string {
  if (!failureReason) {
    return 'Le paiement a échoué. Veuillez réessayer.';
  }

  // Handle string format (if already JSON stringified)
  if (typeof failureReason === 'string') {
    try {
      const parsed = JSON.parse(failureReason);
      return parseFailureReason(parsed);
    } catch {
      // If parsing fails, return the string as-is
      return failureReason || 'Le paiement a échoué. Veuillez réessayer.';
    }
  }

  // Handle object format
  if (typeof failureReason === 'object' && failureReason !== null) {
    const reason = failureReason as FailureReason;
    const failureCode = reason.failureCode;
    const failureMessage = reason.failureMessage;

    // Map common failure codes to user-friendly messages
    if (failureCode === 'INSUFFICIENT_BALANCE') {
      return 'Votre solde est insuffisant pour effectuer ce paiement. Veuillez recharger votre compte et réessayer.';
    }

    // If we have a failure message, use it
    if (failureMessage) {
      return failureMessage;
    }

    // If we only have a code, provide generic message
    if (failureCode) {
      return `Le paiement a échoué. Code d'erreur: ${failureCode}. Veuillez réessayer.`;
    }
  }

  // Fallback to generic message
  return 'Le paiement a échoué. Veuillez réessayer.';
}

