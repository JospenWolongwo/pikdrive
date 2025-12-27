import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaymentProviderType } from "@/lib/payment/types";
import { getAvailableProviders } from "@/lib/payment/provider-config";
import type { PaymentStatus as PaymentTransactionStatus } from "@/lib/payment/types";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useBookingStore } from "@/stores";
import { useNotificationPromptTrigger } from "@/hooks/notifications/useNotificationPrompt";
import type { RideWithDriver } from "@/types";

interface UseBookingModalProps {
  isOpen: boolean;
  ride: RideWithDriver | null;
  onBookingComplete?: () => void;
}

export function useBookingModal({
  isOpen,
  ride,
  onBookingComplete,
}: UseBookingModalProps) {
  const { supabase, user } = useSupabase();
  const router = useRouter();
  const {
    createBooking,
    isCreatingBooking,
    getExistingBookingForRide,
    getCachedBookingForRide,
    userBookings,
    userBookingsLoading,
  } = useBookingStore();
  const { triggerPrompt } = useNotificationPromptTrigger();

  const [step, setStep] = useState(1);
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderType>();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [bookingId, setBookingId] = useState<string>();
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "SUCCESSFUL" | "FAILED" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isPolling, setIsPolling] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const totalPrice = seats * (ride?.price || 0);
  const providers = getAvailableProviders().map((p) => ({
    name: p.name as PaymentProviderType,
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
      setPaymentSuccess(false);
      // Clear any pending navigation timeout
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // Check for existing booking when modal opens - optimized with cache
  useEffect(() => {
    if (isOpen && user && ride && user.id && !userBookingsLoading) {
      checkExistingBooking();
    }
  }, [isOpen, user, ride, userBookings, userBookingsLoading]);

  const checkExistingBooking = async () => {
    if (!ride || !user) return;

    try {
      // First, check cached user bookings for instant response
      const cachedBooking = getCachedBookingForRide(ride.id, user.id);

      if (cachedBooking) {
        // Use cached data immediately for instant UI update
        setExistingBooking(cachedBooking);
        setSeats(cachedBooking.seats);
        setBookingId(cachedBooking.id);

        if (cachedBooking.payment_status === "paid") {
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

        if (existing.payment_status === "paid") {
          setStep(2);
        }
      }
    } catch (error) {
      console.error("Error checking existing booking:", error);
    }
  };

  const handleCreateBooking = async () => {
    if (!user || !ride || isCreatingBooking) return;

    try {
      // Use the booking store to create/update booking (without auto-refresh for performance)
      const booking = await createBooking(
        {
          ride_id: ride.id,
          user_id: user.id,
          seats: seats,
        },
        { refreshUserBookings: false }
      ); // Don't auto-refresh for performance

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
        error instanceof Error ? error.message : "Échec de la création de la réservation"
      );
    }
  };

  const handlePayment = async () => {
    if (!selectedProvider || !isPhoneValid || !bookingId) {
      toast.error(
        "Veuillez sélectionner un mode de paiement et entrer un numéro de téléphone valide"
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
        throw new Error(data.message || "Le paiement a échoué");
      }

      if (data.success && data.data?.transaction_id) {
        setPaymentTransactionId(data.data.transaction_id);
        toast.success("Demande de paiement envoyée. Vérifiez votre téléphone pour approuver.");
      } else {
        throw new Error(data.error || "Le paiement a échoué");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Le paiement a échoué");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = async (status: PaymentTransactionStatus) => {
    if (status === "completed" && ride) {
      // Trigger notification prompt after payment completion
      // This is the highest value moment - user just completed transaction
      // Use priority=true to bypass 24h cooldown for critical payment events
      triggerPrompt(true);

      // Show success state immediately
      setPaymentSuccess(true);
      setStep(3);

      // Navigate after 800ms WITHOUT calling onClose()
      // Navigation will unmount component, closing modal naturally
      navigationTimeoutRef.current = setTimeout(() => {
        router.replace("/bookings");
      }, 800);

      if (onBookingComplete) {
        onBookingComplete();
      }

      // Note: Driver notification is sent automatically by OneSignal via PaymentOrchestrationService
    }
  };

  return {
    // State
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
    userBookingsLoading,
    userBookings,
    isCreatingBooking,
    // Setters
    setSeats,
    setSelectedProvider,
    setPhoneNumber,
    setIsPhoneValid,
    setStep,
    // Handlers
    handleCreateBooking,
    handlePayment,
    handlePaymentComplete,
  };
}

