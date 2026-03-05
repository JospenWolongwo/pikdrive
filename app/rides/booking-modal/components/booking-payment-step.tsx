"use client";

import { Button } from "@/components/ui";
import { Loader2, AlertCircle } from "lucide-react";
import { PaymentMethodSelector, PhoneNumberInput, PaymentStatusChecker } from "@/components";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui";
import { format } from "date-fns";
import type { PaymentProviderType, PaymentStatus as PaymentTransactionStatus } from "@/lib/payment";
import { useLocale } from "@/hooks";

interface BookingPaymentStepProps {
  totalPrice: number;
  providers: Array<{
    name: PaymentProviderType;
    logo: string;
    displayName: string;
    description: string;
    processingTime: string;
    minimumAmount: number;
    maximumAmount: number;
    processingFee: number;
  }>;
  selectedProvider: PaymentProviderType | undefined;
  phoneNumber: string;
  isPhoneValid: boolean;
  loading: boolean;
  isBusy: boolean;
  paymentTransactionId: string | null;
  bookingId: string | undefined;
  existingBooking?: any;
  ride?: any;
  seats?: number;
  selectedPickupPointId?: string;
  paymentError?: string;
  onProviderSelect: (provider: PaymentProviderType) => void;
  onPhoneNumberChange: (phone: string) => void;
  onPhoneValidityChange: (isValid: boolean) => void;
  onPayment: () => void;
  onBack: () => void;
  onPaymentComplete: (status: PaymentTransactionStatus, message?: string) => void;
  onRetry?: () => void;
}

export function BookingPaymentStep({
  totalPrice,
  providers,
  selectedProvider,
  phoneNumber,
  isPhoneValid,
  loading,
  isBusy,
  paymentTransactionId,
  bookingId,
  existingBooking,
  ride,
  seats,
  selectedPickupPointId,
  paymentError,
  onProviderSelect,
  onPhoneNumberChange,
  onPhoneValidityChange,
  onPayment,
  onBack,
  onPaymentComplete,
  onRetry,
}: BookingPaymentStepProps) {
  const { t } = useLocale();
  const isPartialPayment = existingBooking && 
    (existingBooking.payment_status === 'completed' || existingBooking.payment_status === 'partial_refund') &&
    seats && seats > existingBooking.seats;
  const selectedPickupPoint = ride?.pickup_points?.find(
    (point: { id: string; time_offset_minutes?: number }) => point.id === selectedPickupPointId
  );
  const derivedTravelStart =
    existingBooking?.policy?.travelStartAt ||
    existingBooking?.pickup_time ||
    (ride?.departure_time
      ? new Date(
          new Date(ride.departure_time).getTime() +
            (selectedPickupPoint?.time_offset_minutes || 0) * 60 * 1000
        ).toISOString()
      : null);
  const derivedCutoff =
    existingBooking?.policy?.cancellationCutoffAt ||
    (derivedTravelStart
      ? new Date(
          new Date(derivedTravelStart).getTime() - 6 * 60 * 60 * 1000
        ).toISOString()
      : null);
  const cutoffLabel = derivedCutoff ? format(new Date(derivedCutoff), "PPP p") : null;
  const travelStartLabel = derivedTravelStart
    ? format(new Date(derivedTravelStart), "PPP p")
    : null;
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-6 min-w-0">
        <div className="space-y-2 min-w-0">
          <h3 className="font-medium break-words">{t("pages.rides.booking.payment.title")}</h3>
          <PaymentMethodSelector
            providers={providers}
            selectedProvider={selectedProvider}
            onSelect={onProviderSelect}
            disabled={isBusy || paymentTransactionId !== null}
          />
        </div>

        {paymentTransactionId ? (
          <Alert>
            <AlertTitle>{t("pages.rides.booking.payment.promptNoticeTitle")}</AlertTitle>
            <AlertDescription>
              {t("pages.rides.booking.payment.promptNoticeBody")}
            </AlertDescription>
          </Alert>
        ) : null}

        <PhoneNumberInput
          value={phoneNumber}
          onChange={onPhoneNumberChange}
          onValidityChange={onPhoneValidityChange}
          provider={selectedProvider?.toLowerCase() as "mtn" | "orange"}
          disabled={isBusy || paymentTransactionId !== null}
        />

        {isPartialPayment && ride ? (
          <div className="space-y-2 border rounded-lg p-4 bg-muted/50 min-w-0">
            <div className="flex flex-wrap justify-between gap-x-2 text-sm min-w-0">
              <span className="text-muted-foreground break-words">{t("pages.rides.booking.payment.alreadyPaidSeats")}</span>
              <span className="whitespace-nowrap">{existingBooking.seats} {existingBooking.seats > 1 ? t("pages.rides.booking.payment.places") : t("pages.rides.booking.payment.place")}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-2 text-sm min-w-0">
              <span className="text-muted-foreground break-words">{t("pages.rides.booking.payment.additionalSeats")}</span>
              <span className="whitespace-nowrap">{seats! - existingBooking.seats} {(seats! - existingBooking.seats) > 1 ? t("pages.rides.booking.payment.places") : t("pages.rides.booking.payment.place")}</span>
            </div>
            <div className="flex flex-wrap justify-between items-center gap-x-2 text-lg font-semibold pt-2 border-t min-w-0">
              <span className="break-words">{t("pages.rides.booking.payment.amountToPay")}</span>
              <span className="text-primary whitespace-nowrap">{totalPrice.toLocaleString()} FCFA</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-between items-center gap-x-2 text-lg font-semibold min-w-0">
            <span className="break-words">{t("pages.rides.booking.payment.amountToPay")}</span>
            <span className="text-primary whitespace-nowrap">{totalPrice.toLocaleString()} FCFA</span>
          </div>
        )}

        {cutoffLabel && travelStartLabel ? (
          <Alert>
            <AlertTitle>{t("pages.rides.booking.payment.cancellationPolicyTitle")}</AlertTitle>
            <AlertDescription>
              <p>
                {t("pages.rides.booking.payment.cancellationPolicyBody", {
                  cutoff: cutoffLabel,
                  travelStart: travelStartLabel,
                })}
              </p>
              {existingBooking &&
              (existingBooking.payment_status === 'completed' ||
                existingBooking.payment_status === 'partial_refund') ? (
                <p className="mt-2">
                  {t("pages.rides.booking.payment.existingPaidBookingPolicy")}
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {paymentError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("pages.rides.booking.payment.paymentError")}</AlertTitle>
            <AlertDescription>
              <p className="mb-3">{paymentError}</p>
              {onRetry && (
                <Button
                  onClick={onRetry}
                  variant="outline"
                  size="sm"
                >
                  {t("pages.rides.booking.payment.retry")}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : paymentTransactionId ? (
          <PaymentStatusChecker
            transactionId={paymentTransactionId}
            provider={selectedProvider!}
            bookingId={bookingId}
            onPaymentComplete={onPaymentComplete}
          />
        ) : loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>{t("pages.rides.booking.payment.initiating")}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2 mt-6">
        <Button
          onClick={onBack}
          variant="outline"
          disabled={isBusy || paymentTransactionId !== null}
        >
          {t("pages.rides.booking.payment.back")}
        </Button>
        <Button
          onClick={onPayment}
          disabled={
            isBusy ||
            paymentTransactionId !== null ||
            !selectedProvider ||
            !isPhoneValid
          }
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("pages.rides.booking.payment.processing")}
            </>
          ) : paymentTransactionId ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("pages.rides.booking.payment.waiting")}
            </>
          ) : (
            t("pages.rides.booking.payment.pay")
          )}
        </Button>
      </div>
    </div>
  );
}
