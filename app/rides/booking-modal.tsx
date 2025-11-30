"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MapPin,
  Users,
  Clock,
  Car,
  ArrowRight,
  Loader2,
  Check,
} from "lucide-react";
import { PaymentMethodSelector } from "@/components/payment/payment-method-selector";
import { PhoneNumberInput } from "@/components/payment/phone-number-input";
import { PaymentProviderType } from "@/lib/payment/types";
import { getAvailableProviders } from "@/lib/payment/provider-config";
import type { PaymentStatus } from "@/types/booking";
import type { PaymentStatus as PaymentTransactionStatus } from "@/lib/payment/types";
import { useSupabase } from "@/providers/SupabaseProvider";
import { toast } from "sonner";
import { format } from "date-fns";
import { PaymentStatusChecker } from "@/components/payment/payment-status-checker";
import { useRouter } from "next/navigation";
import { getGlobalBookingNotificationManager } from "@/lib/notifications/booking-notification-manager";
import { useBookingStore } from "@/stores";
import type { RideWithDriver } from "@/types";
import { useNotificationPromptTrigger } from "@/hooks/notifications/useNotificationPrompt";

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
  const { supabase, user } = useSupabase();
  const router = useRouter();
  const { 
    createBooking, 
    isCreatingBooking, 
    createBookingError,
    getExistingBookingForRide,
    getCachedBookingForRide,
    userBookings,
    userBookingsLoading,
    fetchUserBookings
  } = useBookingStore();
  const { triggerPrompt } = useNotificationPromptTrigger();
  
  const [step, setStep] = useState(1);
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<PaymentProviderType>();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [bookingId, setBookingId] = useState<string>();
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [paymentTransactionId, setPaymentTransactionId] = useState<
    string | null
  >(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "PENDING" | "SUCCESSFUL" | "FAILED" | null
  >(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isPolling, setIsPolling] = useState(false);

  if (!ride) return null;

  // Show loading state while user bookings are being loaded
  if (isOpen && userBookingsLoading && userBookings.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loading booking information...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const totalPrice = seats * ride.price;
  const providers = getAvailableProviders().map(p => ({
    name: p.name,
    logo: p.logo,
    displayName: p.displayName,
    description: p.description,
    processingTime: p.processingTime,
    minimumAmount: p.minimumAmount,
    maximumAmount: p.maximumAmount,
    processingFee: p.processingFee,
  }));

  // Reset modal state when it closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSeats(1);
      setExistingBooking(null);
      setBookingId(undefined);
      setSelectedProvider(undefined);
      setPhoneNumber("");
      setIsPhoneValid(false);
      setPaymentTransactionId(null);
      setPaymentStatus(null);
      setStatusMessage("");
      setIsPolling(false);
    }
  }, [isOpen]);

  // Check for existing booking when modal opens - optimized with cache
  useEffect(() => {
    if (isOpen && user && ride && user.id && !userBookingsLoading) {
      checkExistingBooking();
    }
  }, [isOpen, user, ride, userBookings, userBookingsLoading]);

  const checkExistingBooking = async () => {
    try {
      // First, check cached user bookings for instant response
      const cachedBooking = getCachedBookingForRide(ride.id, user.id);
      
      if (cachedBooking) {
        // Use cached data immediately for instant UI update
        setExistingBooking(cachedBooking);
        setSeats(cachedBooking.seats);
        setBookingId(cachedBooking.id);
        
        if (cachedBooking.payment_status === 'paid') {
          setStep(2);
        }
        return; // Exit early with cached data
      }
      
      // If not in cache, fetch from API (this should rarely happen)
      const existing = await getExistingBookingForRide(ride.id, user.id);
      
      if (existing) {
        setExistingBooking(existing);
        setSeats(existing.seats);
        setBookingId(existing.id);
        
        if (existing.payment_status === 'paid') {
          setStep(2);
        }
      }
    } catch (error) {
      console.error('Error checking existing booking:', error);
    }
  };

  const handleCreateBooking = async () => {
    if (!user || isCreatingBooking) return;

    try {
      // Use the booking store to create/update booking (without auto-refresh for performance)
      const booking = await createBooking({
        ride_id: ride.id,
        user_id: user.id,
        seats: seats,
      }, { refreshUserBookings: false }); // Don't auto-refresh for performance

      // Move to step 2 IMMEDIATELY - don't wait for notifications
      setBookingId(booking.id);
      setStep(2);

      // Trigger notification prompt after booking creation
      // This is a critical moment - user is committed to booking
      // Use priority=true to bypass 24h cooldown for critical booking events
      triggerPrompt(true);

      // NOTE: Notifications removed here - they will be sent AFTER payment completes
      // This prevents sending driver notification before payment is confirmed
    } catch (error) {
      console.error("Booking creation failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create booking"
      );
    }
  };

  // NOTE: This notification function is now DISABLED
  // Driver notifications will ONLY be sent AFTER payment completes
  // This prevents confusion and ensures driver only gets notified of confirmed (paid) bookings
  // The notification will be sent from the payment orchestration service after successful payment

  // Background driver payment notification function (non-blocking)
  const showDriverPaymentNotificationInBackground = async () => {
    try {
      const bookingManager = getGlobalBookingNotificationManager();
      if (bookingManager && ride.driver_id && bookingId) {
        try {
          // Get the booking data to show driver notification
          const { data: booking } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", bookingId)
            .single();

          if (booking) {
            await bookingManager.showImmediateBookingNotification(
              booking,
              ride,
              true // true = driver notification
            );
          }
        } catch (notificationError) {
          console.warn("Failed to show driver payment notification:", notificationError);
        }
      }
    } catch (error) {
      console.warn("⚠️ Background driver payment notification error:", error);
    }
  };

  const handlePayment = async () => {
    if (!selectedProvider || !isPhoneValid || !bookingId) {
      toast.error(
        "Please select a payment method and enter a valid phone number"
      );
      return;
    }

    try {
      setLoading(true);

      const paymentRequest = {
        bookingId: bookingId,
        amount: totalPrice,
        provider: selectedProvider.toLowerCase() as "mtn" | "orange",
        phoneNumber: phoneNumber,
      };

      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentRequest),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Payment failed");
      }

      if (data.success && data.data?.transaction_id) {
        setPaymentTransactionId(data.data.transaction_id);
        toast.success("Payment request sent. Check your phone to approve.");
      } else {
        throw new Error(data.error || "Payment failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = async (status: PaymentTransactionStatus) => {
    if (status === "completed") {
      setStep(3);
      if (onBookingComplete) {
        onBookingComplete();
      }
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: // Seat selection
        return (
          <>
            <div className="space-y-6">
              {existingBooking && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Modification de réservation :</strong> Vous avez déjà une réservation pour ce trajet. 
                    Vous pouvez modifier le nombre de places ou procéder au paiement.
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{ride.from_city}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{ride.to_city}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      {format(new Date(ride.departure_time), "PPp")}
                    </div>
                    <div className="flex items-center">
                      <Car className="mr-1 h-4 w-4" />
                      {ride.estimated_duration || 'N/A'}h
                    </div>
                    <div className="flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {ride.seats_available} seats available
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seats">Number of Seats</Label>
                <Input
                  id="seats"
                  type="number"
                  min={1}
                  max={ride.seats_available}
                  value={seats}
                  onChange={(e) => setSeats(parseInt(e.target.value))}
                />
              </div>

              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total Price:</span>
                <span className="text-primary">
                  {totalPrice.toLocaleString()} FCFA
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleCreateBooking}
                disabled={
                  seats < 1 || seats > ride.seats_available || isCreatingBooking
                }
              >
                {isCreatingBooking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {existingBooking ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    {existingBooking ? 'Update & Continue to Payment' : 'Continue to Payment'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </>
        );

      case 2: // Payment
        return (
          <>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium">Select Payment Method</h3>
                <PaymentMethodSelector
                  providers={providers}
                  selectedProvider={selectedProvider}
                  onSelect={setSelectedProvider}
                  disabled={loading || paymentTransactionId !== null}
                />
              </div>

              <PhoneNumberInput
                value={phoneNumber}
                onChange={setPhoneNumber}
                onValidityChange={setIsPhoneValid}
                provider={selectedProvider?.toLowerCase() as "mtn" | "orange"}
                disabled={loading || paymentTransactionId !== null}
              />

              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Amount to Pay:</span>
                <span className="text-primary">
                  {totalPrice.toLocaleString()} FCFA
                </span>
              </div>

              {paymentTransactionId ? (
                <PaymentStatusChecker
                  transactionId={paymentTransactionId}
                  provider={selectedProvider!}
                  bookingId={bookingId} // ✅ Pass bookingId for resilient fallback queries
                  onPaymentComplete={async (status) => {
                    if (status === "completed") {
                      // Trigger notification prompt after payment completion
                      // This is the highest value moment - user just completed transaction
                      // Use priority=true to bypass 24h cooldown for critical payment events
                      triggerPrompt(true);

                      // Close modal immediately and redirect to bookings page
                      onClose();
                      router.replace("/bookings");
                      
                      if (onBookingComplete) {
                        onBookingComplete();
                      }

                      // Show success notification to driver in background
                      showDriverPaymentNotificationInBackground();
                    }
                  }}
                />
              ) : loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Initiating payment...</span>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button
                onClick={() => {
                  if (!paymentTransactionId) {
                    setStep(1);
                  }
                }}
                variant="outline"
                disabled={loading || paymentTransactionId !== null}
              >
                Back
              </Button>
              <Button
                onClick={handlePayment}
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
                    Processing...
                  </>
                ) : paymentTransactionId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Waiting...
                  </>
                ) : (
                  "Pay Now"
                )}
              </Button>
            </div>
          </>
        );

      case 3: // Success
        return (
          <>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold">Booking Successful!</h3>
              <p className="text-muted-foreground">
                Your booking has been confirmed. You will receive a confirmation
                message shortly.
              </p>
              <div className="mt-6">
                <Button onClick={onClose} className="w-full">
                  Done
                </Button>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Only allow closing if we're not in the middle of a payment
        if (!open && !isPolling && !loading) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? "Book Your Ride"
              : step === 2
              ? "Payment Details"
              : "Booking Confirmation"}
          </DialogTitle>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
