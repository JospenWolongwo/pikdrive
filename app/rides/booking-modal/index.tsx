"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RideWithDriver } from "@/types";
import { useBookingModal } from "./hooks/use-booking-modal";
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
    isPolling,
    paymentSuccess,
    totalPrice,
    providers,
    isCreatingBooking,
    userBookingsLoading,
    userBookings,
    setSeats,
    setSelectedProvider,
    setPhoneNumber,
    setIsPhoneValid,
    setStep,
    handleCreateBooking,
    handlePayment,
    handlePaymentComplete,
  } = useBookingModal({
    isOpen,
    ride,
    onBookingComplete,
  });

  if (!ride) return null;

  // Show loading state while user bookings are being loaded
  if (isOpen && userBookingsLoading && userBookings.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chargement des informations de réservation...</DialogTitle>
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
      case 1:
        return (
          <BookingSeatSelection
            ride={ride}
            seats={seats}
            existingBooking={existingBooking}
            totalPrice={totalPrice}
            isCreatingBooking={isCreatingBooking}
            onSeatsChange={setSeats}
            onCreateBooking={handleCreateBooking}
            onClose={onClose}
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
      case 1:
        return "Réserver votre trajet";
      case 2:
        return "Détails du paiement";
      case 3:
        return "Confirmation de réservation";
      default:
        return "Réserver votre trajet";
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}

