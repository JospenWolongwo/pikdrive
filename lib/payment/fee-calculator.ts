/**
 * Fee Calculator Service
 * Calculates transaction fees and commissions for driver payouts
 * All fees are configurable via environment variables
 */

export interface FeeCalculationResult {
  originalAmount: number;
  transactionFee: number;
  commission: number;
  driverEarnings: number;
  breakdown: {
    transactionFeeRate: number;
    commissionRate: number;
    transactionFeeAmount: number;
    commissionAmount: number;
  };
}

/**
 * Calculate driver earnings after fees
 * 
 * Formula: Driver Earnings = Original Amount - Transaction Fee - Commission
 * 
 * Transaction Fee: Fixed amount or percentage (configurable)
 * Commission: Percentage of original amount (configurable)
 */
export class FeeCalculator {
  /**
   * Get transaction fee rate (percentage or fixed amount)
   */
  private static getTransactionFeeRate(): number {
    // Transaction fee as percentage (e.g., 1.5% = 0.015)
    // Default: 0% (no fee initially to keep costs low)
    const rate = parseFloat(process.env.TRANSACTION_FEE_RATE || '0');
    return rate / 100; // Convert percentage to decimal
  }

  /**
   * Get transaction fee fixed amount (in XAF)
   */
  private static getTransactionFeeFixed(): number {
    // Fixed transaction fee in XAF
    // Default: 0 XAF (no fixed fee initially)
    return parseFloat(process.env.TRANSACTION_FEE_FIXED || '0');
  }

  /**
   * Get commission rate (percentage)
   */
  private static getCommissionRate(): number {
    // Commission as percentage (e.g., 5% = 0.05)
    // Default: 0% (no commission initially to keep costs low)
    const rate = parseFloat(process.env.COMMISSION_RATE || '0');
    return rate / 100; // Convert percentage to decimal
  }

  /**
   * Calculate fees and driver earnings
   */
  static calculate(originalAmount: number): FeeCalculationResult {
    const transactionFeeRate = this.getTransactionFeeRate();
    const transactionFeeFixed = this.getTransactionFeeFixed();
    const commissionRate = this.getCommissionRate();

    // Calculate transaction fee (percentage + fixed)
    const transactionFeePercentage = originalAmount * transactionFeeRate;
    const transactionFeeAmount = transactionFeePercentage + transactionFeeFixed;

    // Calculate commission
    const commissionAmount = originalAmount * commissionRate;

    // Calculate driver earnings
    const driverEarnings = originalAmount - transactionFeeAmount - commissionAmount;

    // Ensure driver earnings is not negative
    const finalDriverEarnings = Math.max(0, driverEarnings);

    return {
      originalAmount,
      transactionFee: transactionFeeAmount,
      commission: commissionAmount,
      driverEarnings: finalDriverEarnings,
      breakdown: {
        transactionFeeRate: transactionFeeRate * 100, // Convert back to percentage for display
        commissionRate: commissionRate * 100, // Convert back to percentage for display
        transactionFeeAmount,
        commissionAmount,
      },
    };
  }

  /**
   * Get formatted fee breakdown for logging/display
   */
  static getFormattedBreakdown(amount: number): string {
    const result = this.calculate(amount);
    return `
      Original Amount: ${result.originalAmount.toLocaleString('fr-FR')} XAF
      Transaction Fee (${result.breakdown.transactionFeeRate}% + ${process.env.TRANSACTION_FEE_FIXED || 0} XAF): ${result.transactionFee.toLocaleString('fr-FR')} XAF
      Commission (${result.breakdown.commissionRate}%): ${result.commission.toLocaleString('fr-FR')} XAF
      Driver Earnings: ${result.driverEarnings.toLocaleString('fr-FR')} XAF
    `.trim();
  }
}


