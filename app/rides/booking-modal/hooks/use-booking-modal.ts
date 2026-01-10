import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaymentProviderType } from "@/lib/payment/types";
import { getAvailableProviders } from "@/lib/payment/provider-config";
import type { PaymentStatus as PaymentTransactionStatus } from "@/lib/payment/types";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useBookingStore } from "@/stores";
import { useNotificationPromptTrigger } from "@/hooks/notifications/useNotificationPrompt";
import { useLocale } from "@/hooks";
import type { RideWithDriver } from "@/types";
import { ApiError } from "@/lib/api-client/error";

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
  const { user } = useSupabase();
  const router = useRouter();
  const { t } = useLocale();
  const {
    createBooking,
    isCreatingBooking,
    getExistingBookingForRide,
    getCachedBookingForRide,
    userBookings,
    userBookingsLoading,
    checkPassengerInfo: checkPassengerInfoStore,
    getCachedPassengerInfo,
    invalidatePassengerInfoCache,
    passengerInfoLoading,
  } = useBookingStore();
  const { triggerPrompt } = useNotificationPromptTrigger();

  const [step, setStep] = useState(0);
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderType>();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [bookingId, setBookingId] = useState<string>();
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [originalSeats, setOriginalSeats] = useState<number | null>(null);
  const [originalPaymentStatus, setOriginalPaymentStatus] = useState<string | null>(null);
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "SUCCESSFUL" | "FAILED" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isPolling, setIsPolling] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isPassengerInfoComplete, setIsPassengerInfoComplete] = useState<boolean | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  const [bookingError, setBookingError] = useState<string | null>(null); // NEW: Store booking creation errors
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total price - for paid bookings, only charge for additional seats
  const calculateTotalPrice = (): number => {
    if (!ride?.price) return 0;
    
    // Check if we're adding seats to an existing paid booking
    // Use originalPaymentStatus to detect if the original booking was paid
    if (originalSeats !== null && originalSeats > 0 && seats > originalSeats && originalPaymentStatus === 'completed') {
      const additionalSeats = seats - originalSeats;
      return additionalSeats * ride.price;
    }
    
    // For new bookings or unpaid bookings, charge for all seats
    return seats * ride.price;
  };

  const totalPrice = calculateTotalPrice();
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

  // Check passenger info when modal opens - using cached store
  const checkPassengerInfo = useCallback(async () => {
    if (!user) {
      setIsPassengerInfoComplete(false);
      return;
    }

    // First check cache
    const cached = getCachedPassengerInfo();
    if (cached) {
      // DEFENSIVE: Ensure isComplete is always a boolean (fix corrupted localStorage)
      const isComplete = typeof cached.isComplete === 'boolean' ? cached.isComplete : false;
      setIsPassengerInfoComplete(isComplete);
      setProfileName(cached.profileName || "");
      setStep(isComplete ? 1 : 0);
      return;
    }

    // If not cached, fetch from store (which uses API client)
    try {
      const result = await checkPassengerInfoStore(user.id);
      // DEFENSIVE: Ensure isComplete is always a boolean
      const isComplete = typeof result.isComplete === 'boolean' ? result.isComplete : false;
      setIsPassengerInfoComplete(isComplete);
      setProfileName(result.profileName || "");
      setStep(isComplete ? 1 : 0);
    } catch (error) {
      console.error("Error checking passenger info:", error);
      setIsPassengerInfoComplete(false);
      setStep(0);
    }
  }, [user, checkPassengerInfoStore, getCachedPassengerInfo]);

  // Check passenger info when modal opens
  useEffect(() => {
    if (isOpen && user) {
      checkPassengerInfo();
    }
  }, [isOpen, user, checkPassengerInfo]);

  // Reset modal state when it closes
  useEffect(() => {
    if (!isOpen) {
      // Don't clear navigation timeout if we're in payment success state
      // This allows navigation to happen even if modal closes
      if (!paymentSuccess && navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      
      // Only reset state if not in payment success (to allow success step to show)
      if (!paymentSuccess) {
        setStep(0);
        setSeats(1);
        setExistingBooking(null);
        setOriginalSeats(null);
        setOriginalPaymentStatus(null);
        setBookingId(undefined);
        setSelectedProvider(undefined);
        setPhoneNumber("");
        setIsPhoneValid(false);
        setPaymentTransactionId(null);
        setPaymentStatus(null);
        setStatusMessage("");
        setIsPolling(false);
        setIsPassengerInfoComplete(null);
        setProfileName("");
        setBookingError(null); // Clear booking error when modal closes
      }
    }
  }, [isOpen, paymentSuccess]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // Check for existing booking when modal opens - only after passenger info is confirmed complete
  useEffect(() => {
    // DEFENSIVE: Ensure isPassengerInfoComplete is a boolean for comparison (fix corrupted localStorage)
    const isComplete = typeof isPassengerInfoComplete === 'boolean' && isPassengerInfoComplete === true;
    if (isOpen && user && ride && user.id && !userBookingsLoading && isComplete && step >= 1) {
      checkExistingBooking();
    }
  }, [isOpen, user, ride, userBookings, userBookingsLoading, isPassengerInfoComplete, step]);

  const checkExistingBooking = async () => {
    if (!ride || !user) return;

    try {
      // First, check cached user bookings for instant response
      const cachedBooking = getCachedBookingForRide(ride.id, user.id);

      if (cachedBooking) {
        // Use cached data immediately for instant UI update
        setExistingBooking(cachedBooking);
        setSeats(cachedBooking.seats);
        setOriginalSeats(cachedBooking.seats);
        setOriginalPaymentStatus(cachedBooking.payment_status);
        setBookingId(cachedBooking.id);

        if (cachedBooking.payment_status === "completed") {
          // For paid bookings, don't auto-advance to payment step
          // User should be able to see seat selection and add more seats if needed
        }
        return; // Exit early with cached data
      }

      // If not in cache, fetch from API (this should rarely happen)
      const existing = await getExistingBookingForRide(ride.id, user.id);

      if (existing) {
        setExistingBooking(existing);
        setSeats(existing.seats);
        setOriginalSeats(existing.seats);
        setOriginalPaymentStatus(existing.payment_status);
        setBookingId(existing.id);

        if (existing.payment_status === "completed") {
          // For paid bookings, don't auto-advance to payment step
          // User should be able to see seat selection and add more seats if needed
        }
      }
    } catch (error) {
      // Silently fail - booking check error
    }
  };

  const handlePassengerInfoComplete = () => {
    // Invalidate cache and update state
    invalidatePassengerInfoCache();
    // Force refresh to update cache with new completion status
    checkPassengerInfoStore(user!.id, true).then((result) => {
      setIsPassengerInfoComplete(result.isComplete);
      setProfileName(result.profileName);
      setStep(1); // Move to seat selection
    });
  };

  const handleCreateBooking = async () => {
    if (!user || !ride || isCreatingBooking) return;

    // Clear previous error
    setBookingError(null);

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
      // Extract clear error message from ApiError or regular Error
      let errorMessage = null;
      
      if (error instanceof ApiError) {
        errorMessage = error.getDisplayMessage();
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Store error to display in modal instead of toast
      if (errorMessage) {
        setBookingError(errorMessage);
        // Keep user on seat selection step so they can see the error and fix it
      }
    }
  };

  const handlePayment = async () => {
    if (!selectedProvider || !isPhoneValid || !bookingId) {
      toast.error(t("pages.rides.booking.payment.validationError"));
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
        throw new Error(data.message || t("pages.rides.booking.payment.failed"));
      }

      if (data.success && data.data?.transaction_id) {
        setPaymentTransactionId(data.data.transaction_id);
        toast.success(t("pages.rides.booking.payment.requestSent"));
      } else {
        throw new Error(data.error || t("pages.rides.booking.payment.failed"));
      }
    } catch (error) {
      // Extract clear error message from ApiError or regular Error
      let errorMessage = t("pages.rides.booking.payment.failed");
      
      if (error instanceof ApiError) {
        errorMessage = error.getDisplayMessage();
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = async (status: PaymentTransactionStatus, message?: string) => {
    if (status === "completed" && ride) {
      // Trigger notification prompt after payment completion
      // This is the highest value moment - user just completed transaction
      // Use priority=true to bypass 24h cooldown for critical payment events
      triggerPrompt(true);

      // Show success state immediately
      setPaymentSuccess(true);
      setStep(3);

      // Navigate after showing success step (2000ms to ensure user sees confirmation)
      navigationTimeoutRef.current = setTimeout(() => {
        router.replace("/bookings");
      }, 2000);
    } else if (status === "failed") {
      // Reset payment transaction ID to enable form fields
      setPaymentTransactionId(null);
      // Store error message for display
      setStatusMessage(message || t("pages.rides.booking.payment.failedRetry"));
      setPaymentStatus("FAILED");
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
    isPassengerInfoComplete,
    checkingPassengerInfo: passengerInfoLoading,
    profileName,
    bookingError, // NEW: Expose booking error
    // Setters
    setSeats,
    setSelectedProvider,
    setPhoneNumber,
    setIsPhoneValid,
    setStep,
    setStatusMessage,
    setPaymentStatus,
    setBookingError, // NEW: Allow clearing error
    // Handlers
    handlePassengerInfoComplete,
    handleCreateBooking,
    handlePayment,
    handlePaymentComplete,
  };
}

