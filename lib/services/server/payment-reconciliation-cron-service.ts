import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ServerPaymentService,
  ServerPaymentOrchestrationService,
} from "./index";
import { PaymentReconciliationService } from "@/lib/services/payment-reconciliation.service";
import { PayoutReconciliationService } from "@/lib/services/payout-reconciliation.service";
import { PawaPayService, mapPawaPayStatus } from "@/lib/payment";
import { Environment as EnvEnum, FeatureFlag, PawaPayApiUrl } from "@/types/payment-ext";
import type { Environment } from "@/types/payment-ext";

export class PaymentReconciliationCronService {
  constructor(private supabase: SupabaseClient) {}

  async run(): Promise<{
    payments: { checked: number; results: any[] };
    payouts: { checked: number; results: any[] };
    refunds: { checked: number; results: any[] };
  }> {
    const paymentService = new ServerPaymentService(this.supabase);
    const orchestrationService = new ServerPaymentOrchestrationService(this.supabase);
    const paymentReconciliationService = new PaymentReconciliationService(
      orchestrationService
    );
    const payoutReconciliationService = new PayoutReconciliationService(
      this.supabase
    );
    const usePawaPay = process.env.USE_PAWAPAY === FeatureFlag.USE_PAWAPAY;

    const { data: stalePayments, error } = await this.supabase
      .from("payments")
      .select("*")
      .in("status", ["pending", "processing"])
      .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (error) {
      console.error("âŒ Error fetching stale payments:", error);
      throw error;
    }

    console.log("ðŸ” Found stale payments:", stalePayments?.length || 0);

    const { data: stalePayouts, error: payoutError } = await this.supabase
      .from("payouts")
      .select("*")
      .in("status", ["pending", "processing"])
      .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (payoutError) {
      console.error("âŒ Error fetching stale payouts:", payoutError);
    }

    console.log("ðŸ” Found stale payouts:", stalePayouts?.length || 0);

    const paymentResults =
      await paymentReconciliationService.reconcilePayments(stalePayments || []);

    const payoutResults =
      await payoutReconciliationService.reconcilePayouts(stalePayouts || []);

    let refundResults: Array<{
      id: string;
      status: string;
      updated: boolean;
      error?: string;
    }> = [];

    if (usePawaPay) {
      const pawaPayEnvironment =
        (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment;
      const pawapayService = new PawaPayService({
        apiToken: process.env.PAWAPAY_API_TOKEN || "",
        baseUrl:
          process.env.PAWAPAY_BASE_URL ||
          (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION
            ? PawaPayApiUrl.PRODUCTION
            : PawaPayApiUrl.SANDBOX),
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/pawapay`,
        environment: pawaPayEnvironment,
      });

      const { data: staleRefunds, error: refundError } = await this.supabase
        .from("refunds")
        .select("*")
        .in("status", ["pending", "processing"])
        .not("transaction_id", "is", null)
        .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (refundError) {
        console.error("âŒ Error fetching stale refunds:", refundError);
      } else {
        for (const refund of staleRefunds || []) {
          try {
            const payoutStatus = await pawapayService.checkPayoutStatus(
              refund.transaction_id
            );
            if (!payoutStatus?.status) {
              refundResults.push({
                id: refund.id,
                status: refund.status,
                updated: false,
              });
              continue;
            }

            const mappedStatus = mapPawaPayStatus(payoutStatus.status);
            if (mappedStatus !== refund.status) {
              const { error: refundUpdateError } = await this.supabase
                .from("refunds")
                .update({
                  status: mappedStatus,
                  updated_at: new Date().toISOString(),
                  metadata: {
                    ...refund.metadata,
                    reconciledAt: new Date().toISOString(),
                    reconciliationSource: "cron",
                    providerStatus: payoutStatus.status,
                  },
                })
                .eq("id", refund.id);

              if (refundUpdateError) {
                console.error(
                  "âŒ Error updating refund during reconciliation:",
                  refundUpdateError
                );
                refundResults.push({
                  id: refund.id,
                  status: refund.status,
                  updated: false,
                  error: refundUpdateError.message,
                });
                continue;
              }

              if (
                mappedStatus === "completed" &&
                refund.refund_type === "partial" &&
                refund.booking_id
              ) {
                const { data: booking, error: bookingError } =
                  await this.supabase
                    .from("bookings")
                    .select("id, status, payment_status")
                    .eq("id", refund.booking_id)
                    .maybeSingle();

                if (
                  !bookingError &&
                  booking &&
                  booking.status !== "cancelled" &&
                  booking.payment_status === "partial"
                ) {
                  const { error: bookingUpdateError } = await this.supabase
                    .from("bookings")
                    .update({
                      payment_status: "completed",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", booking.id);

                  if (bookingUpdateError) {
                    console.error(
                      "âŒ Error restoring booking payment_status after refund:",
                      bookingUpdateError
                    );
                  }
                }
              }

              refundResults.push({
                id: refund.id,
                status: mappedStatus,
                updated: true,
              });
            } else {
              refundResults.push({
                id: refund.id,
                status: refund.status,
                updated: false,
              });
            }
          } catch (reconcileError) {
            console.error("âŒ Error reconciling refund:", reconcileError);
            refundResults.push({
              id: refund.id,
              status: refund.status,
              updated: false,
              error:
                reconcileError instanceof Error
                  ? reconcileError.message
                  : "Unknown error",
            });
          }
        }
      }
    }

    return {
      payments: {
        checked: paymentResults.length,
        results: paymentResults,
      },
      payouts: {
        checked: payoutResults.length,
        results: payoutResults,
      },
      refunds: {
        checked: refundResults.length,
        results: refundResults,
      },
    };
  }
}
