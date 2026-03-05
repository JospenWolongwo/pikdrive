import type { BookingPolicy, BookingPolicyBlockReason } from '@/types';

type BookingPolicyInput = {
  status?: string | null;
  payment_status?: string | null;
  code_verified?: boolean | null;
  pickup_time?: string | null;
  departure_time?: string | null;
  no_show_marked_at?: string | null;
};

const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'pending_verification']);
const FINALIZED_BOOKING_STATUSES = new Set(['cancelled', 'completed', 'expired']);
const PAID_BOOKING_STATUSES = new Set(['completed', 'partial', 'partial_refund']);

export class ServerBookingPolicyService {
  private readonly enabled = process.env.ENABLE_BOOKING_LATE_POLICY === 'true';
  private readonly lateCancelHours = Number.parseInt(
    process.env.BOOKING_LATE_CANCEL_HOURS || '6',
    10
  );
  private readonly noShowGraceMinutes = Number.parseInt(
    process.env.BOOKING_NO_SHOW_GRACE_MINUTES || '15',
    10
  );

  isEnabled(): boolean {
    return this.enabled;
  }

  evaluatePolicy(
    input: BookingPolicyInput,
    now = new Date()
  ): BookingPolicy | undefined {
    if (!this.enabled) {
      return undefined;
    }

    const travelStartAt = input.pickup_time || input.departure_time;
    if (!travelStartAt) {
      return undefined;
    }

    const travelStart = new Date(travelStartAt);
    if (Number.isNaN(travelStart.getTime())) {
      return undefined;
    }

    const cancellationCutoffAt = new Date(
      travelStart.getTime() - this.lateCancelHours * 60 * 60 * 1000
    );
    const noShowEligibleAt = new Date(
      travelStart.getTime() + this.noShowGraceMinutes * 60 * 1000
    );

    const status = input.status ?? null;
    const isLateWindow = now.getTime() >= cancellationCutoffAt.getTime();
    const isActive = status !== null && ACTIVE_BOOKING_STATUSES.has(status);
    const isFinalized = status !== null && FINALIZED_BOOKING_STATUSES.has(status);
    const isPaidBooking = PAID_BOOKING_STATUSES.has(input.payment_status ?? '');

    let blockReason: BookingPolicyBlockReason = 'none';
    if (input.no_show_marked_at) {
      blockReason = 'already_no_show';
    } else if (input.code_verified === true) {
      blockReason = 'code_verified';
    } else if (isFinalized) {
      blockReason = 'finalized';
    } else if (isLateWindow) {
      blockReason = 'late_window';
    }

    return {
      travelStartAt: travelStart.toISOString(),
      cancellationCutoffAt: cancellationCutoffAt.toISOString(),
      noShowEligibleAt: noShowEligibleAt.toISOString(),
      canCancel: isActive && blockReason === 'none',
      canReduceSeats: isActive && isPaidBooking && blockReason === 'none',
      canDriverMarkNoShow:
        isActive &&
        isPaidBooking &&
        input.code_verified !== true &&
        !input.no_show_marked_at &&
        now.getTime() >= noShowEligibleAt.getTime(),
      blockReason,
      isLateWindow,
    };
  }

  attachPolicy<T extends BookingPolicyInput>(booking: T): T & { policy?: BookingPolicy } {
    const policy = this.evaluatePolicy(booking);
    if (!policy) {
      return booking as T & { policy?: BookingPolicy };
    }

    return {
      ...booking,
      policy,
    };
  }
}

