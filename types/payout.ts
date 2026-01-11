import type { Booking } from './booking';
import type { Ride } from './ride';

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PayoutProvider = 'mtn' | 'orange' | 'pawapay';

/**
 * Metadata structure for payout records
 * Supports cumulative payouts with multiple payments
 */
export interface PayoutMetadata {
  readonly payment_ids?: string[]; // All payment IDs included in this payout (for cumulative payouts)
  readonly payment_count?: number; // Number of payments combined in this payout
  readonly individual_amounts?: ReadonlyArray<{ id: string; amount: number }>; // Breakdown of each payment
  readonly apiResponse?: any;
  readonly payoutInitiatedAt?: string;
  readonly error?: string;
  readonly payoutFailedAt?: string;
  readonly retryCount?: number;
  readonly lastRetryAttempt?: string;
  readonly retryHistory?: any[];
  readonly [key: string]: any; // Allow additional fields
}

export interface Payout {
  readonly id: string;
  readonly driver_id: string;
  readonly booking_id: string;
  readonly payment_id: string; // Primary payment ID (most recent for cumulative payouts)
  readonly amount: number; // driver earnings after fees
  readonly original_amount: number; // original payment amount (sum of all payments for cumulative payouts)
  readonly transaction_fee: number;
  readonly commission: number;
  readonly currency: string;
  readonly provider: PayoutProvider;
  readonly phone_number: string;
  readonly transaction_id?: string | null;
  readonly status: PayoutStatus;
  readonly reason?: string | null;
  readonly metadata?: PayoutMetadata; // Typed metadata for better type safety
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PayoutWithDetails extends Payout {
  readonly booking?: {
    readonly id: string;
    readonly seats: number;
    readonly status: string;
    readonly created_at: string;
    readonly ride?: {
      readonly id: string;
      readonly from_city: string;
      readonly to_city: string;
      readonly departure_time: string;
    };
  };
  readonly payment?: {
    readonly id: string;
    readonly amount: number;
    readonly currency: string;
    readonly provider: string;
  };
}

export interface PayoutStatistics {
  readonly totalEarnings: number;
  readonly pendingAmount: number;
  readonly processingAmount: number;
  readonly completedCount: number;
  readonly completedAmount: number;
  readonly failedCount: number;
  readonly thisMonthEarnings: number;
  readonly totalCount: number;
}

export interface PayoutsResponse {
  readonly payouts: PayoutWithDetails[];
  readonly statistics: PayoutStatistics;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly total: number;
  };
}

