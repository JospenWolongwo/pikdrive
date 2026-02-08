import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaymentProviderType } from "@/lib/payment/types";
import { getAvailableProviders } from "@/lib/payment/provider-config";
import type { PaymentStatus as PaymentTransactionStatus } from "@/lib/payment/types";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useBookingStore, useRidesStore } from "@/stores";
import { useNotificationPromptTrigger, useLocale } from "@/hooks";
import type { RideWithDriver } from "@/types";
import { ApiError, paymentApiClient } from "@/lib/api-client";

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
  const { updateRideSeatsOptimistically } = useRidesStore();
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
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string | undefined>(undefined);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-select pickup point when there is exactly one option
  useEffect(() => {
    if (!isOpen) return;
    if (!ride?.pickup_points || ride.pickup_points.length !== 1) return;
    if (selectedPickupPointId) return;
    const onlyPoint = ride.pickup_points[0];
    if (onlyPoint?.id) {
      setSelectedPickupPointId(onlyPoint.id);
    }
  }, [isOpen, ride?.pickup_points, selectedPickupPointId]);

  // Calculate total price - for paid bookings, only charge for additional seats
  const calculateTotalPrice = (): number => {
    if (!ride?.price) return 0;
    
    // For existing paid bookings, only charge for additional seats
    if (originalPaymentStatus === 'completed' && originalSeats !== null) {
      // If user hasn't added any seats yet, nothing to pay
      if (seats <= originalSeats) {
        return 0;
      }
      // Calculate price for only the additional seats
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
      
      // Smart reset: Keep booking context if pending/partial payment
      // This allows user to return and complete payment without confusion
      const hasPendingPayment = existingBooking && 
        (existingBooking.payment_status === 'pending' || 
         existingBooking.payment_status === 'partial');
      
      // Only reset state if not in payment success AND no pending payment
      if (!paymentSuccess && !hasPendingPayment) {
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
        setSelectedPickupPointId(undefined);
      } else if (hasPendingPayment) {
        // For pending payments, only clear payment-specific state
        // Keep booking context so user can resume
        setSelectedProvider(undefined);
        setPhoneNumber("");
        setIsPhoneValid(false);
        setPaymentTransactionId(null);
        setPaymentStatus(null);
        setStatusMessage("");
        setIsPolling(false);
        setBookingError(null);
      }
    }
  }, [isOpen, paymentSuccess, existingBooking]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // Check for existing booking when modal opens - only after passenger info is confirmed complete
  // Guard: never overwrite step when we're on success (avoids "already paid" replacing success step)
  useEffect(() => {
    if (paymentSuccess || step === 3) return;
    // DEFENSIVE: Ensure isPassengerInfoComplete is a boolean for comparison (fix corrupted localStorage)
    const isComplete = typeof isPassengerInfoComplete === 'boolean' && isPassengerInfoComplete === true;
    if (isOpen && user && ride && user.id && !userBookingsLoading && isComplete) {
      checkExistingBooking();
    }
  // step/paymentSuccess intentionally omitted from deps: we only read them to guard, not to re-run
  }, [isOpen, user, ride, userBookings, userBookingsLoading, isPassengerInfoComplete]);

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

        // Smart step detection based on payment status
        if (cachedBooking.payment_status === "completed") {
          // Paid booking - stay at seat selection to add more seats
          setStep(1);
        } else if (cachedBooking.payment_status === "pending" || cachedBooking.payment_status === "partial") {
          // Unpaid/partially paid booking - go directly to payment step
          setStep(2);
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
        setSelectedPickupPointId(existing.selected_pickup_point_id);

        // Smart step detection based on payment status
        if (existing.payment_status === "completed") {
          // Paid booking - stay at seat selection to add more seats
          setStep(1);
        } else if (existing.payment_status === "pending" || existing.payment_status === "partial") {
          // Unpaid/partially paid booking - go directly to payment step
          setStep(2);
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

    // Validate pickup point selection if ride has pickup points
    if (ride.pickup_points && ride.pickup_points.length > 0) {
      if (!selectedPickupPointId) {
        setBookingError(t("pages.rides.booking.pickupPoint.required"));
        return;
      }
    }

    try {
      // Use the booking store to create/update booking (without auto-refresh for performance)
      const booking = await createBooking(
        {
          ride_id: ride.id,
          user_id: user.id,
          seats: seats,
          selected_pickup_point_id: selectedPickupPointId,
        },
        { refreshUserBookings: false }
      ); // Don't auto-refresh for performance

      // Move to step 2 IMMEDIATELY - don't wait for notifications
      setBookingId(booking.id);
      setStep(2);

      // Use priority=true to bypass 24h cooldown for critical booking events
      triggerPrompt(true);

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

      const data = await paymentApiClient.createPayment({
        booking_id: paymentRequest.bookingId,
        amount: paymentRequest.amount,
        provider: paymentRequest.provider,
        phone_number: paymentRequest.phoneNumber,
      });

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
      // Optimistically update the ride's available seats for instant UI feedback
      // Only decrement if this is a new booking or adding seats to existing
      const seatsToDecrement = originalPaymentStatus === 'completed' && originalSeats !== null
        ? seats - originalSeats  // Only new seats for paid bookings
        : seats;  // All seats for new bookings
      
      if (seatsToDecrement > 0) {
        updateRideSeatsOptimistically(ride.id, seatsToDecrement);
      }

      // Show success state immediately; keep modal open so user sees it
      setPaymentSuccess(true);
      setStep(3);

      // After 2s: close modal and navigate to bookings together (avoids closing modal
      // before success step and prevents timeout from being cleared on unmount)
      navigationTimeoutRef.current = setTimeout(() => {
        if (onBookingComplete) {
          onBookingComplete();
        }
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
      selectedPickupPointId,
      // Setters
      setSeats,
      setSelectedProvider,
      setPhoneNumber,
      setIsPhoneValid,
      setStep,
      setStatusMessage,
      setPaymentStatus,
      setBookingError, // NEW: Allow clearing error
      setSelectedPickupPointId,
      // Handlers
      handlePassengerInfoComplete,
      handleCreateBooking,
      handlePayment,
      handlePaymentComplete,
    };
}
