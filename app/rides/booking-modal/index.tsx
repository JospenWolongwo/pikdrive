"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RideWithDriver } from "@/types";
import { useBookingModal } from "./hooks/use-booking-modal";
import { useLocale } from "@/hooks";
import { BookingPassengerInfoStep } from "./components/booking-passenger-info-step";
import { BookingSeatSelection } from "./components/booking-seat-selection";
import { BookingPaymentStep } from "./components/booking-payment-step";
import { BookingSuccessStep } from "./components/booking-success-step";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ride: RideWithDriver | null;
  onBookingComplete?: () => void;
}

export function BookingModal({
  isOpen,
  onClose,
  ride,
  onBookingComplete,
}: BookingModalProps) {
  const { t } = useLocale();
  const {
    step,
    seats,
    loading,
    selectedProvider,
    phoneNumber,
    isPhoneValid,
    bookingId,
    existingBooking,
    paymentTransactionId,
    paymentStatus,
    statusMessage,
    isPolling,
    paymentSuccess,
    totalPrice,
    providers,
    isCreatingBooking,
    userBookingsLoading,
    userBookings,
    checkingPassengerInfo,
    profileName,
    bookingError,
    setSeats,
    setSelectedProvider,
    setPhoneNumber,
    setIsPhoneValid,
    setStep,
    setStatusMessage,
    setPaymentStatus,
    setBookingError,
    handlePassengerInfoComplete,
    handleCreateBooking,
    handlePayment,
    handlePaymentComplete,
  } = useBookingModal({
    isOpen,
    ride,
    onBookingComplete,
  });

  // Handle retry after payment failure
  const handleRetry = () => {
    setStatusMessage("");
    setPaymentStatus(null);
  };

  if (!ride) return null;

  // Show loading state while checking passenger info or user bookings are being loaded
  if (isOpen && (checkingPassengerInfo || (userBookingsLoading && userBookings.length === 0))) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pages.rides.booking.loadingInfo")}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <BookingPassengerInfoStep
            onComplete={handlePassengerInfoComplete}
            onClose={onClose}
            initialName={profileName}
          />
        );

      case 1:
        return (
          <BookingSeatSelection
            ride={ride}
            seats={seats}
            existingBooking={existingBooking}
            totalPrice={totalPrice}
            isCreatingBooking={isCreatingBooking}
            bookingError={bookingError}
            onSeatsChange={setSeats}
            onCreateBooking={handleCreateBooking}
            onClose={onClose}
            onErrorClear={() => setBookingError(null)}
          />
        );

      case 2:
        return (
          <BookingPaymentStep
            totalPrice={totalPrice}
            providers={providers}
            selectedProvider={selectedProvider}
            phoneNumber={phoneNumber}
            isPhoneValid={isPhoneValid}
            loading={loading}
            paymentTransactionId={paymentTransactionId}
            bookingId={bookingId}
            existingBooking={existingBooking}
            ride={ride}
            seats={seats}
            paymentError={paymentStatus === "FAILED" ? statusMessage : undefined}
            onProviderSelect={setSelectedProvider}
            onPhoneNumberChange={setPhoneNumber}
            onPhoneValidityChange={setIsPhoneValid}
            onPayment={handlePayment}
            onBack={() => {
              if (!paymentTransactionId) {
                setStep(1);
              }
            }}
            onPaymentComplete={handlePaymentComplete}
            onRetry={handleRetry}
          />
        );

      case 3:
        return <BookingSuccessStep paymentSuccess={paymentSuccess} onClose={onClose} />;

      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (step) {
      case 0:
        return t("pages.rides.booking.modalTitles.passengerInfo");
      case 1:
        return t("pages.rides.booking.modalTitles.seatSelection");
      case 2:
        return t("pages.rides.booking.modalTitles.payment");
      case 3:
        return t("pages.rides.booking.modalTitles.success");
      default:
        return t("pages.rides.booking.modalTitles.seatSelection");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Prevent closing during payment success state (navigation in progress)
        // Only allow closing if we're not in the middle of a payment or success navigation
        if (!open && !isPolling && !loading && !paymentSuccess) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={`sm:max-w-[500px] ${
          step === 0 || step === 2 ? "max-h-[90vh] flex flex-col" : ""
        }`}
      >
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        {step === 0 || step === 2 ? (
          <div className="overflow-y-auto flex-1">{renderStep()}</div>
        ) : (
          renderStep()
        )}
      </DialogContent>
    </Dialog>
  );
}

