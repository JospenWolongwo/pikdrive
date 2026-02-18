import type { SupabaseClient } from "@supabase/supabase-js";
import { ServerMultiChannelNotificationService } from "./multi-channel-notification-service";
import { ServerPaymentInitiationService } from "./payment-initiation-service";

type RideRecord = {
  id: string;
  driver_id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  status: "active" | "cancelled" | string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type BookingRecord = {
  id: string;
  user_id: string;
  seats: number;
  status: string;
  payment_status: string;
  user: ProfileRecord | ProfileRecord[] | null;
};

type PaymentRecord = {
  id: string;
  amount: number;
  currency: string | null;
  provider: string | null;
  phone_number: string | null;
  status: string;
  created_at: string;
};

type RefundApiResult = {
  refundInitiated: boolean;
  refundStatusLabel: string;
};

export type CancelRideResult = {
  rideCancelled: boolean;
  rideAlreadyCancelled: boolean;
  activeBookingsFound: number;
  cancelledBookings: number;
  paidBookings: number;
  refundsInitiated: number;
  refundsFailed: number;
  notificationOnesignalSent: number;
  notificationWhatsAppSent: number;
  failedBookings: Array<{ bookingId: string; error: string }>;
};

export class RideCancellationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "RideCancellationError";
    this.statusCode = statusCode;
  }
}

export class ServerRideCancellationService {
  private multiChannelService: ServerMultiChannelNotificationService;

  constructor(
    private supabase: SupabaseClient,
    private serviceSupabase?: SupabaseClient
  ) {
    this.multiChannelService = new ServerMultiChannelNotificationService(supabase);
  }

  async cancelRide(params: {
    rideId: string;
    driverId: string;
    reason?: string;
  }): Promise<CancelRideResult> {
    const { rideId, driverId, reason } = params;
    const nowIso = new Date().toISOString();

    const { data: rideData, error: rideError } = await this.supabase
      .from("rides")
      .select("id, driver_id, from_city, to_city, departure_time, status")
      .eq("id", rideId)
      .single();

    if (rideError || !rideData) {
      throw new RideCancellationError("Ride not found", 404);
    }

    const ride = rideData as RideRecord;

    if (ride.driver_id !== driverId) {
      throw new RideCancellationError(
        "Access denied. You can only cancel your own rides.",
        403
      );
    }

    const { count: verifiedCount, error: verifiedError } = await this.supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("ride_id", rideId)
      .eq("code_verified", true)
      .in("status", ["confirmed", "completed"]);

    if (verifiedError) {
      throw new RideCancellationError(
        `Failed to validate ride bookings: ${verifiedError.message}`,
        500
      );
    }

    if ((verifiedCount || 0) > 0) {
      throw new RideCancellationError(
        "This ride cannot be cancelled automatically because at least one passenger was already verified. Please contact support.",
        409
      );
    }

    const rideAlreadyCancelled = ride.status === "cancelled";
    if (!rideAlreadyCancelled) {
      const { error: rideUpdateError } = await this.supabase
        .from("rides")
        .update({
          status: "cancelled",
          cancelled_at: nowIso,
          cancelled_by: driverId,
          cancellation_reason: reason || null,
          updated_at: nowIso,
        })
        .eq("id", rideId);

      if (rideUpdateError) {
        throw new RideCancellationError(
          `Failed to cancel ride: ${rideUpdateError.message}`,
          500
        );
      }
    }

    const { data: bookingsData, error: bookingsError } = await this.supabase
      .from("bookings")
      .select(
        `
        id,
        user_id,
        seats,
        status,
        payment_status,
        user:user_id (
          id,
          full_name,
          phone
        )
      `
      )
      .eq("ride_id", rideId)
      .in("status", ["pending", "pending_verification", "confirmed"]);

    if (bookingsError) {
      throw new RideCancellationError(
        `Failed to fetch ride bookings: ${bookingsError.message}`,
        500
      );
    }

    const bookings = (bookingsData || []) as BookingRecord[];

    let cancelledBookings = 0;
    let paidBookings = 0;
    let refundsInitiated = 0;
    let refundsFailed = 0;
    let notificationOnesignalSent = 0;
    let notificationWhatsAppSent = 0;
    const failedBookings: Array<{ bookingId: string; error: string }> = [];

    for (const booking of bookings) {
      try {
        const passenger = this.normalizeProfile(booking.user, booking.user_id);
        const paymentSummary = await this.getCompletedPayments(booking.id);
        const hasPaidBooking = paymentSummary.totalPaid > 0 && paymentSummary.payments.length > 0;

        let refundStatusLabel = "Trajet annule par le chauffeur";
        if (hasPaidBooking) {
          paidBookings += 1;
          const refundResult = await this.cancelPaidBookingAndInitiateRefund({
            booking,
            ride,
            passenger,
            totalPaid: paymentSummary.totalPaid,
            payments: paymentSummary.payments,
          });

          if (refundResult.refundInitiated) {
            refundsInitiated += 1;
          } else {
            refundsFailed += 1;
          }
          refundStatusLabel = refundResult.refundStatusLabel;
        } else {
          await this.cancelUnpaidBooking(booking.id);
        }

        const notificationResult = await this.multiChannelService.sendBookingCancelled({
          userId: passenger.id,
          phoneNumber: passenger.phone || undefined,
          userName: passenger.full_name || "Passager",
          route: `${ride.from_city} -> ${ride.to_city}`,
          refundAmount: hasPaidBooking ? paymentSummary.totalPaid : undefined,
          refundStatus: refundStatusLabel,
          cancelledByDriver: true,
          cancellationReason: reason,
          bookingId: booking.id,
        });

        if (notificationResult.onesignal) {
          notificationOnesignalSent += 1;
        }
        if (notificationResult.whatsapp) {
          notificationWhatsAppSent += 1;
        }

        cancelledBookings += 1;
      } catch (error) {
        failedBookings.push({
          bookingId: booking.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      rideCancelled: true,
      rideAlreadyCancelled,
      activeBookingsFound: bookings.length,
      cancelledBookings,
      paidBookings,
      refundsInitiated,
      refundsFailed,
      notificationOnesignalSent,
      notificationWhatsAppSent,
      failedBookings,
    };
  }

  private normalizeProfile(
    user: ProfileRecord | ProfileRecord[] | null,
    fallbackUserId: string
  ): ProfileRecord {
    if (Array.isArray(user)) {
      const first = user[0];
      if (first) {
        return first;
      }
    } else if (user) {
      return user;
    }

    return {
      id: fallbackUserId,
      full_name: null,
      phone: null,
    };
  }

  private async getCompletedPayments(bookingId: string): Promise<{
    payments: PaymentRecord[];
    totalPaid: number;
  }> {
    const { data: paymentsData, error: paymentsError } = await this.supabase
      .from("payments")
      .select("id, amount, currency, provider, phone_number, status, created_at")
      .eq("booking_id", bookingId)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (paymentsError) {
      throw new RideCancellationError(
        `Failed to fetch payments for booking ${bookingId}: ${paymentsError.message}`,
        500
      );
    }

    const payments = (paymentsData || []) as PaymentRecord[];
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return { payments, totalPaid };
  }

  private async cancelUnpaidBooking(bookingId: string): Promise<void> {
    const { data: cancelResult, error: cancelError } = await this.supabase.rpc(
      "cancel_booking_and_restore_seats",
      {
        p_booking_id: bookingId,
      }
    );

    if (cancelError) {
      throw new RideCancellationError(
        `Failed to cancel booking ${bookingId}: ${cancelError.message}`,
        500
      );
    }

    if (!cancelResult) {
      throw new RideCancellationError(
        `Booking cancellation function returned false for booking ${bookingId}`,
        500
      );
    }
  }

  private async cancelPaidBookingAndInitiateRefund(params: {
    booking: BookingRecord;
    ride: RideRecord;
    passenger: ProfileRecord;
    totalPaid: number;
    payments: PaymentRecord[];
  }): Promise<RefundApiResult> {
    const { booking, ride, passenger, totalPaid, payments } = params;
    const primaryPayment = payments[0];

    if (!primaryPayment) {
      return {
        refundInitiated: false,
        refundStatusLabel: "Aucun paiement detecte",
      };
    }

    const paymentIds = payments.map((payment) => payment.id);
    const refundPhoneNumber = primaryPayment.phone_number || passenger.phone || "";
    const refundProvider = primaryPayment.provider || "mtn";
    const refundCurrency = primaryPayment.currency || "XAF";

    const { data: atomicResult, error: atomicError } = await this.supabase.rpc(
      "cancel_booking_with_refund_preparation",
      {
        p_booking_id: booking.id,
        p_user_id: booking.user_id,
        p_refund_amount: totalPaid,
        p_refund_currency: refundCurrency,
        p_refund_provider: refundProvider,
        p_refund_phone_number: refundPhoneNumber,
        p_payment_ids: paymentIds,
      }
    );

    if (atomicError) {
      throw new RideCancellationError(
        `Atomic cancellation failed for booking ${booking.id}: ${atomicError.message}`,
        500
      );
    }

    const atomic = (atomicResult?.[0] || null) as
      | {
          success: boolean;
          refund_record_id: string | null;
          error_message: string | null;
        }
      | null;

    if (!atomic || !atomic.success) {
      throw new RideCancellationError(
        atomic?.error_message || `Atomic cancellation returned no result for booking ${booking.id}`,
        500
      );
    }

    const refundRecordId = atomic.refund_record_id;
    return this.processExternalRefund({
      booking,
      ride,
      totalPaid,
      primaryPayment,
      payments,
      refundPhoneNumber,
      refundRecordId,
    });
  }

  private async processExternalRefund(params: {
    booking: BookingRecord;
    ride: RideRecord;
    totalPaid: number;
    primaryPayment: PaymentRecord;
    payments: PaymentRecord[];
    refundPhoneNumber: string;
    refundRecordId: string | null;
  }): Promise<RefundApiResult> {
    const {
      booking,
      ride,
      totalPaid,
      primaryPayment,
      payments,
      refundPhoneNumber,
      refundRecordId,
    } = params;

    const adminSupabase = this.serviceSupabase || this.supabase;
    const initiationService = new ServerPaymentInitiationService();
    const orchestrator = initiationService.buildOrchestrator();

    try {
      const refundResult = await orchestrator.refund({
        phoneNumber: refundPhoneNumber,
        amount: totalPaid,
        reason: `Driver cancellation: ${ride.from_city} to ${ride.to_city}`,
        originalPaymentId: primaryPayment.id,
        currency: primaryPayment.currency || "XAF",
        bookingId: booking.id,
        userId: booking.user_id,
      });

      if (refundResult.response.success) {
        if (refundRecordId) {
          await this.updateRefundRecord(adminSupabase, {
            refundRecordId,
            transactionId: refundResult.response.refundId || undefined,
            status: "processing",
            metadataPatch: {
              payment_ids: payments.map((payment) => payment.id),
              payment_count: payments.length,
              individual_amounts: payments.map((payment) => ({
                id: payment.id,
                amount: payment.amount,
              })),
              apiResponse: refundResult.response.apiResponse,
              refundInitiatedAt: new Date().toISOString(),
              externalApiSuccess: true,
              externalApiCalledAt: new Date().toISOString(),
            },
          });
        }

        return {
          refundInitiated: true,
          refundStatusLabel: "Remboursement en cours",
        };
      }

      if (refundRecordId) {
        await this.updateRefundRecord(adminSupabase, {
          refundRecordId,
          status: "failed",
          metadataPatch: {
            payment_ids: payments.map((payment) => payment.id),
            payment_count: payments.length,
            error: refundResult.response.message || "Refund failed",
            refundFailedAt: new Date().toISOString(),
            externalApiSuccess: false,
            externalApiFailedAt: new Date().toISOString(),
          },
        });
      }

      return {
        refundInitiated: false,
        refundStatusLabel: "Remboursement echoue. Support notifie.",
      };
    } catch (error) {
      if (refundRecordId) {
        await this.updateRefundRecord(adminSupabase, {
          refundRecordId,
          status: "failed",
          metadataPatch: {
            error: error instanceof Error ? error.message : String(error),
            exceptionAt: new Date().toISOString(),
            externalApiSuccess: false,
            externalApiExceptionAt: new Date().toISOString(),
          },
        });
      }

      return {
        refundInitiated: false,
        refundStatusLabel: "Remboursement echoue. Support notifie.",
      };
    }
  }

  private async updateRefundRecord(
    supabase: SupabaseClient,
    params: {
      refundRecordId: string;
      status: string;
      transactionId?: string;
      metadataPatch: Record<string, unknown>;
    }
  ): Promise<void> {
    const { refundRecordId, status, transactionId, metadataPatch } = params;

    const { data: existingRefund } = await supabase
      .from("refunds")
      .select("metadata")
      .eq("id", refundRecordId)
      .maybeSingle();

    const existingMetadata =
      ((existingRefund?.metadata as Record<string, unknown> | null) || {});

    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      metadata: {
        ...existingMetadata,
        ...metadataPatch,
      },
    };

    if (transactionId) {
      updatePayload.transaction_id = transactionId;
    }

    const { error: updateError } = await supabase
      .from("refunds")
      .update(updatePayload)
      .eq("id", refundRecordId);

    if (updateError) {
      console.error("[RIDE-CANCELLATION] Failed to update refund record:", {
        refundRecordId,
        error: updateError.message,
      });
    }
  }
}
