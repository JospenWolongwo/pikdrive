"use client";

import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";

import { VerificationCodeDisplay } from "@/components";
import { Button, CardContent } from "@/components/ui";
import { useLocale } from "@/hooks";

import type { BookingWithPayments } from "@/types";

import type { BookingPayment } from "./use-booking-card";

interface BookingCardDetailsProps {
  booking: BookingWithPayments;
  payment?: BookingPayment;
  isCompleted: boolean;
  displayStatus: string;
  isNoShow: boolean;
  showCutoffHint: boolean;
  cutoffLabel: string | null;
  showLateWindowHint: boolean;
  travelStartLabel: string | null;
  shouldShowVerification: boolean;
  showVerification: boolean;
  onToggleVerification: () => void;
}

function getStatusClass(displayStatus: string, isNoShow: boolean) {
  if (isNoShow) return "bg-amber-100 text-amber-800";
  if (displayStatus === "confirmed") return "bg-green-100 text-green-800";
  if (displayStatus === "pending") return "bg-yellow-100 text-yellow-800";
  if (displayStatus === "cancelled") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

export function BookingCardDetails({
  booking,
  payment,
  isCompleted,
  displayStatus,
  isNoShow,
  showCutoffHint,
  cutoffLabel,
  showLateWindowHint,
  travelStartLabel,
  shouldShowVerification,
  showVerification,
  onToggleVerification,
}: BookingCardDetailsProps) {
  const { t } = useLocale();

  return (
    <CardContent>
      <div className="grid gap-2">
        <div>
          <strong>{t("pages.bookings.card.driver")}</strong>{" "}
          {booking.ride.driver?.full_name || t("pages.bookings.card.notAvailable")}
        </div>
        <div>
          <strong>{t("pages.bookings.card.car")}</strong>{" "}
          {booking.ride.car_model || t("pages.bookings.card.notSpecified")} (
          {booking.ride.car_color || t("pages.bookings.card.notSpecified")})
        </div>
        <div>
          <strong>{t("pages.bookings.card.seats")}</strong> {booking.seats}
        </div>
        {booking.pickup_point_name && (
          <div>
            <strong>{t("pages.bookings.card.pickupPoint")}</strong> {booking.pickup_point_name}
            {booking.pickup_time && (
              <span className="ml-2 text-sm text-muted-foreground">
                ({format(new Date(booking.pickup_time), "h:mm a")})
              </span>
            )}
          </div>
        )}
        {booking.dropoff_point_name && (
          <div>
            <strong>{t("pages.rides.rideCard.destinationPoint")}</strong>{" "}
            {booking.dropoff_point_name}
          </div>
        )}
        <div>
          <strong>{t("pages.bookings.card.total")}</strong>{" "}
          {payment
            ? `${payment.amount} ${payment.currency}`
            : booking.ride.price != null
              ? `${(booking.seats * booking.ride.price).toLocaleString()} FCFA`
              : "N/A"}
        </div>
        <div>
          <strong>{t("pages.bookings.card.status")}</strong>{" "}
          <span
            className={`inline-block rounded-full px-2 py-1 text-sm ${getStatusClass(
              displayStatus,
              isNoShow
            )}`}
          >
            {isNoShow
              ? t("pages.bookings.card.statusNoShow")
              : displayStatus === "confirmed"
                ? t("pages.bookings.card.statusConfirmed")
                : displayStatus === "pending"
                  ? t("pages.bookings.card.statusPending")
                  : displayStatus === "cancelled"
                    ? t("pages.bookings.card.statusCancelled")
                    : displayStatus === "pending_verification"
                      ? t("pages.bookings.card.statusPendingVerification")
                      : displayStatus}
          </span>
        </div>
        {payment && (
          <div>
            <strong>{t("pages.bookings.card.payment")}</strong>{" "}
            <span
              className={`inline-block rounded-full px-2 py-1 text-sm ${
                isCompleted ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {isCompleted
                ? t("pages.bookings.card.paymentCompleted")
                : t("pages.bookings.card.paymentPending")}
            </span>
          </div>
        )}

        {showCutoffHint && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">
              {t("pages.bookings.card.freeChangesUntil", { cutoff: cutoffLabel })}
            </p>
          </div>
        )}

        {showLateWindowHint && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">{t("pages.bookings.card.lateWindowLockedTitle")}</p>
            <p className="mt-1">
              {t("pages.bookings.card.lateWindowLockedDescription", {
                cutoff: cutoffLabel,
                travelStart: travelStartLabel,
              })}
            </p>
            <p className="mt-2 text-amber-800/90">
              {t("pages.bookings.card.lateWindowDriverFault")}
            </p>
          </div>
        )}

        {shouldShowVerification && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="flex w-full items-center justify-between"
              onClick={onToggleVerification}
            >
              <span>
                {showVerification
                  ? t("pages.bookings.card.hideCode")
                  : t("pages.bookings.card.showCode")}
              </span>
              {showVerification ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showVerification && (
              <div className="mt-4">
                <VerificationCodeDisplay bookingId={booking.id} />
              </div>
            )}
          </div>
        )}
      </div>
    </CardContent>
  );
}
