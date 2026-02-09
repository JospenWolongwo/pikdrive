import type { SupabaseClient } from "@supabase/supabase-js";
import { ServerOneSignalNotificationService } from "./onesignal-notification-service";
import { ServerPaymentInitiationService } from "./payment-initiation-service";
import { getTranslation, formatAmount } from "@/lib/utils/server-translations";

export class BookingCancellationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "BookingCancellationError";
    this.statusCode = statusCode;
  }
}

type CancelBookingResult = {
  refundInitiated: boolean;
  refundAmount: number;
  refundRecordId: string | null;
  cancellationDebugInfo: any | null;
};

export class ServerBookingCancellationService {
  private notificationService: ServerOneSignalNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.notificationService = new ServerOneSignalNotificationService(supabase);
  }

  async cancelBooking(params: {
    bookingId: string;
    userId: string;
  }): Promise<CancelBookingResult> {
    const { bookingId, userId } = params;

    const { data: booking } = await this.supabase
      .from("bookings")
      .select(
        `
        *,
        ride:ride_id (
          *,
          driver:driver_id (
            id,
            full_name
          )
        ),
        user:user_id (
          id,
          full_name,
          phone
        )
      `
      )
      .eq("id", bookingId)
      .single();

    if (!booking) {
      throw new BookingCancellationError("Booking not found", 404);
    }

    if (booking.code_verified === true) {
      throw new BookingCancellationError(
        "Cancellation is not allowed after the driver has verified the code and been paid. Your trip is confirmed.",
        403
      );
    }

    const { data: payments } = await this.supabase
      .from("payments")
      .select("id, amount, currency, provider, phone_number, status, created_at")
      .eq("booking_id", bookingId)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    const paymentsList = payments ?? [];
    const totalPaid = paymentsList.reduce((sum, p) => sum + p.amount, 0);
    const hasPaidBooking = paymentsList.length > 0 && totalPaid > 0;

    let refundResult: any = null;
    let refundPhoneNumber = booking.user.phone;
    let refundRecordId: string | null = null;
    let cancellationResult: any = null;

    if (hasPaidBooking) {
      const primaryPayment = payments![0];
      refundPhoneNumber = primaryPayment.phone_number;

      console.log(
        "ðŸ”„ [CANCELLATION] Starting atomic cancellation with refund preparation:",
        {
          bookingId,
          userId,
          totalAmount: totalPaid,
          phoneNumber: refundPhoneNumber,
          paymentCount: paymentsList.length,
          paymentIds: paymentsList.map((p) => p.id),
        }
      );

      const { data: atomicResult, error: atomicError } =
        await this.supabase.rpc("cancel_booking_with_refund_preparation", {
          p_booking_id: bookingId,
          p_user_id: userId,
          p_refund_amount: totalPaid,
          p_refund_currency: primaryPayment.currency || "XAF",
          p_refund_provider: primaryPayment.provider,
          p_refund_phone_number: refundPhoneNumber,
          p_payment_ids: paymentsList.map((p) => p.id),
        });

      if (atomicError) {
        console.error("âŒ [CANCELLATION] Atomic cancellation failed:", {
          error: atomicError.message,
          code: atomicError.code,
          details: atomicError.details,
          hint: atomicError.hint,
          bookingId,
        });
        throw new BookingCancellationError(
          `Failed to cancel booking atomically: ${atomicError.message}`
        );
      }

      if (!atomicResult || atomicResult.length === 0) {
        console.error("âŒ [CANCELLATION] Atomic function returned no result");
        throw new BookingCancellationError("Atomic cancellation returned no result");
      }

      cancellationResult = atomicResult[0];

      if (!cancellationResult.success) {
        console.error("âŒ [CANCELLATION] Atomic cancellation failed:", {
          success: cancellationResult.success,
          booking_cancelled: cancellationResult.booking_cancelled,
          error_message: cancellationResult.error_message,
          debug_info: cancellationResult.debug_info,
          bookingId,
        });
        throw new BookingCancellationError(
          cancellationResult.error_message || "Atomic cancellation failed"
        );
      }

      refundRecordId = cancellationResult.refund_record_id;

      console.log("âœ… [CANCELLATION] Atomic cancellation succeeded:", {
        bookingId,
        booking_cancelled: cancellationResult.booking_cancelled,
        refund_record_id: refundRecordId,
        debug_steps: cancellationResult.debug_info?.steps,
      });

      try {
        console.log("ðŸ’¸ [REFUND] Processing external refund API call:", {
          bookingId,
          refundRecordId,
          totalAmount: totalPaid,
          phoneNumber: refundPhoneNumber,
          paymentCount: paymentsList.length,
        });

        const initiationService = new ServerPaymentInitiationService();
        const orchestrator = initiationService.buildOrchestrator();

        refundResult = await orchestrator.refund({
          phoneNumber: refundPhoneNumber,
          amount: totalPaid,
          reason: `Booking cancellation: ${booking.ride.from_city} to ${booking.ride.to_city}`,
          originalPaymentId: primaryPayment.id,
          currency: primaryPayment.currency || "XAF",
          bookingId,
          userId,
        });

        if (refundResult.response.success) {
          console.log("âœ… [REFUND] External refund API succeeded:", {
            refundRecordId,
            transactionId: refundResult.response.refundId,
            amount: totalPaid,
          });

          if (refundRecordId) {
            try {
              const { data: existingRefund, error: fetchError } =
                await this.supabase
                  .from("refunds")
                  .select("metadata")
                  .eq("id", refundRecordId)
                  .single();

              if (fetchError) {
                console.error(
                  "âŒ [REFUND] Failed to fetch existing refund record:",
                  {
                    refundRecordId,
                    error: fetchError.message,
                  }
                );
              }

              const existingMetadata = existingRefund?.metadata || {};

              const { error: updateError } = await this.supabase
                .from("refunds")
                .update({
                  transaction_id: refundResult.response.refundId,
                  status: "processing",
                  updated_at: new Date().toISOString(),
                  metadata: {
                    ...existingMetadata,
                    payment_ids: paymentsList.map((p) => p.id),
                    payment_count: paymentsList.length,
                    individual_amounts: paymentsList.map((p) => ({
                      id: p.id,
                      amount: p.amount,
                    })),
                    apiResponse: refundResult.response.apiResponse,
                    refundInitiatedAt: new Date().toISOString(),
                    externalApiSuccess: true,
                    externalApiCalledAt: new Date().toISOString(),
                  },
                })
                .eq("id", refundRecordId);

              if (updateError) {
                console.error("âŒ [REFUND] Failed to update refund record:", {
                  refundRecordId,
                  error: updateError.message,
                });
              } else {
                console.log(
                  "âœ… [REFUND] Refund record updated with transaction ID"
                );
              }
            } catch (err) {
              console.error(
                "âŒ [REFUND] Exception updating refund record:",
                err
              );
            }
          }
        } else {
          console.error("âŒ [REFUND] External refund API failed:", {
            refundRecordId,
            error: refundResult.response.message,
            bookingId,
          });

          if (refundRecordId) {
            try {
              const { data: existingRefund, error: fetchError } =
                await this.supabase
                  .from("refunds")
                  .select("metadata")
                  .eq("id", refundRecordId)
                  .single();

              if (fetchError) {
                console.error(
                  "âŒ [REFUND] Failed to fetch existing refund record:",
                  {
                    refundRecordId,
                    error: fetchError.message,
                  }
                );
              }

              const existingMetadata = existingRefund?.metadata || {};

              const { error: updateError } = await this.supabase
                .from("refunds")
                .update({
                  status: "failed",
                  updated_at: new Date().toISOString(),
                  metadata: {
                    ...existingMetadata,
                    payment_ids: paymentsList.map((p) => p.id),
                    payment_count: paymentsList.length,
                    error: refundResult.response.message,
                    refundFailedAt: new Date().toISOString(),
                    externalApiSuccess: false,
                    externalApiFailedAt: new Date().toISOString(),
                  },
                })
                .eq("id", refundRecordId);

              if (updateError) {
                console.error(
                  "âŒ [REFUND] Failed to update refund record status:",
                  {
                    refundRecordId,
                    error: updateError.message,
                  }
                );
              } else {
                console.log(
                  "âš ï¸ [REFUND] Refund record marked as failed (can be retried later)"
                );
              }
            } catch (err) {
              console.error(
                "âŒ [REFUND] Exception updating refund record status:",
                err
              );
            }
          }
        }
      } catch (error) {
        console.error("âŒ [REFUND] Exception processing external refund API:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          refundRecordId,
          bookingId,
        });

        if (refundRecordId) {
          try {
            const { data: existingRefund } = await this.supabase
              .from("refunds")
              .select("metadata")
              .eq("id", refundRecordId)
              .single();

            const existingMetadata = existingRefund?.metadata || {};

            await this.supabase
              .from("refunds")
              .update({
                status: "failed",
                updated_at: new Date().toISOString(),
                metadata: {
                  ...existingMetadata,
                  error: error instanceof Error ? error.message : String(error),
                  exceptionAt: new Date().toISOString(),
                  externalApiSuccess: false,
                  externalApiExceptionAt: new Date().toISOString(),
                },
              })
              .eq("id", refundRecordId);
          } catch (err) {
            console.error(
              "âŒ [REFUND] Failed to update refund record after exception:",
              err
            );
          }
        }
      }
    } else {
      console.log("ðŸ”„ [CANCELLATION] Cancelling unpaid booking:", {
        bookingId,
        userId,
      });

      const { data: cancelResult, error: cancelError } =
        await this.supabase.rpc("cancel_booking_and_restore_seats", {
          p_booking_id: bookingId,
        });

      if (cancelError) {
        console.error("âŒ [CANCELLATION] Booking cancellation failed:", {
          error: cancelError.message,
          code: cancelError.code,
          details: cancelError.details,
          hint: cancelError.hint,
          bookingId,
        });
        throw new BookingCancellationError(
          `Failed to cancel booking: ${cancelError.message}`
        );
      }

      if (!cancelResult) {
        console.error("âŒ [CANCELLATION] Cancellation function returned false");
        throw new BookingCancellationError("Failed to cancel booking");
      }

      console.log("âœ… [CANCELLATION] Unpaid booking cancelled successfully");
    }

    await Promise.all([
      this.notificationService
        .sendDriverNotification(booking.ride.driver.id, "booking_cancelled", {
          id: booking.id,
          rideId: booking.ride.id,
          passengerName: booking.user.full_name,
          from: booking.ride.from_city,
          to: booking.ride.to_city,
          date: booking.ride.departure_time,
          seats: booking.seats,
          amount: booking.total_amount,
        })
        .catch((err) => {
          console.error(
            "âŒ Driver cancellation notification error (non-critical):",
            err
          );
        }),
      (async () => {
        const locale: "fr" | "en" = "fr";

        const refundMessage =
          hasPaidBooking && refundResult?.response.success
            ? getTranslation(
                locale,
                "notifications.bookingCancelled.refundProcessing",
                {
                  amount: formatAmount(totalPaid),
                  phone: refundPhoneNumber,
                }
              )
            : hasPaidBooking
            ? getTranslation(
                locale,
                "notifications.bookingCancelled.refundProcessingGeneric"
              )
            : "";

        const title = getTranslation(
          locale,
          "notifications.bookingCancelled.title"
        );
        const baseMessage = getTranslation(
          locale,
          "notifications.bookingCancelled.message",
          {
            from: booking.ride.from_city,
            to: booking.ride.to_city,
          }
        );

        return this.notificationService.sendNotification({
          userId: booking.user.id,
          title,
          message: `${baseMessage}${refundMessage ? ` ${refundMessage}` : ""}`,
          notificationType: "booking_cancelled",
          imageUrl: "/icons/booking-cancelled.svg",
          sendSMS: false,
          data: {
            bookingId: booking.id,
            rideId: booking.ride.id,
            refundInitiated: refundResult?.response.success || false,
            refundAmount: totalPaid,
            refundPhoneNumber,
            type: "booking_cancelled",
            icon: "XCircle",
            action: "view_bookings",
            deepLink: `/bookings/${booking.id}`,
            priority: "high",
          },
        });
      })().catch((err) => {
        console.error(
          "âŒ Passenger cancellation notification error (non-critical):",
          err
        );
      }),
    ]);

    return {
      refundInitiated: refundResult?.response.success || false,
      refundAmount: totalPaid,
      refundRecordId,
      cancellationDebugInfo: cancellationResult?.debug_info || null,
    };
  }
}
