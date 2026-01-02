"use client";

import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { PaymentMethodSelector } from "@/components/payment/payment-method-selector";
import { PhoneNumberInput } from "@/components/payment/phone-number-input";
import { PaymentStatusChecker } from "@/components/payment/payment-status-checker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { PaymentProviderType } from "@/lib/payment/types";
import type { PaymentStatus as PaymentTransactionStatus } from "@/lib/payment/types";
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
  paymentTransactionId: string | null;
  bookingId: string | undefined;
  existingBooking?: any;
  ride?: any;
  seats?: number;
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
  paymentTransactionId,
  bookingId,
  existingBooking,
  ride,
  seats,
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
    existingBooking.payment_status === 'completed' &&
    seats && seats > existingBooking.seats;
  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-medium">{t("pages.rides.booking.payment.title")}</h3>
          <PaymentMethodSelector
            providers={providers}
            selectedProvider={selectedProvider}
            onSelect={onProviderSelect}
            disabled={loading || paymentTransactionId !== null}
          />
        </div>

        <PhoneNumberInput
          value={phoneNumber}
          onChange={onPhoneNumberChange}
          onValidityChange={onPhoneValidityChange}
          provider={selectedProvider?.toLowerCase() as "mtn" | "orange"}
          disabled={loading || paymentTransactionId !== null}
        />

        {isPartialPayment && ride ? (
          <div className="space-y-2 border rounded-lg p-4 bg-muted/50">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("pages.rides.booking.payment.alreadyPaidSeats")}</span>
              <span>{existingBooking.seats} {existingBooking.seats > 1 ? t("pages.rides.booking.payment.places") : t("pages.rides.booking.payment.place")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("pages.rides.booking.payment.additionalSeats")}</span>
              <span>{seats! - existingBooking.seats} {(seats! - existingBooking.seats) > 1 ? t("pages.rides.booking.payment.places") : t("pages.rides.booking.payment.place")}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-semibold pt-2 border-t">
              <span>{t("pages.rides.booking.payment.amountToPay")}</span>
              <span className="text-primary">{totalPrice.toLocaleString()} FCFA</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>{t("pages.rides.booking.payment.amountToPay")}</span>
            <span className="text-primary">{totalPrice.toLocaleString()} FCFA</span>
          </div>
        )}

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

      <div className="flex justify-end space-x-2 mt-6">
        <Button
          onClick={onBack}
          variant="outline"
          disabled={loading || paymentTransactionId !== null}
        >
          {t("pages.rides.booking.payment.back")}
        </Button>
        <Button
          onClick={onPayment}
          disabled={
            loading ||
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
    </>
  );
}

