import type { Booking } from './booking';
import type { Ride } from './ride';

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PayoutProvider = 'mtn' | 'orange';

export interface Payout {
  readonly id: string;
  readonly driver_id: string;
  readonly booking_id: string;
  readonly payment_id: string;
  readonly amount: number; // driver earnings after fees
  readonly original_amount: number; // original payment amount
  readonly transaction_fee: number;
  readonly commission: number;
  readonly currency: string;
  readonly provider: PayoutProvider;
  readonly phone_number: string;
  readonly transaction_id?: string | null;
  readonly status: PayoutStatus;
  readonly reason?: string | null;
  readonly metadata?: Record<string, any>;
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

