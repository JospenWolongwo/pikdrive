"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useBookingVerificationSubscription, useLocale } from "@/hooks";
import { useToast } from "@/hooks/ui";
import { ApiError, bookingApiClient } from "@/lib/api-client";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useBookingStore, useChatStore } from "@/stores";

import type { BookingWithPayments, RideWithDriver } from "@/types";

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "pending_verification"]);

export interface SelectedChatRide {
  ride: RideWithDriver;
  conversationId: string;
}

export type BookingPayment = NonNullable<BookingWithPayments["payments"]>[number];

export function useBookingCard(booking: BookingWithPayments) {
  const { t } = useLocale();
  const { toast } = useToast();
  const { user } = useSupabase();
  const router = useRouter();
  const { conversations } = useChatStore();
  const { refreshUserBookingsSilent } = useBookingStore();

  const payment = booking.payments?.[0];
  const isCompleted = Boolean(
    payment?.payment_time && payment?.metadata?.financialTransactionId
  );

  const [showVerification, setShowVerification] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [codeVerified, setCodeVerified] = useState(Boolean(booking.code_verified));
  const [selectedChatRide, setSelectedChatRide] = useState<SelectedChatRide | null>(null);
  const [showReduceSeatsDialog, setShowReduceSeatsDialog] = useState(false);
  const [showAddSeatsDialog, setShowAddSeatsDialog] = useState(false);
  const [newSeats, setNewSeats] = useState("");
  const [isReducingSeats, setIsReducingSeats] = useState(false);
  const [displayStatus, setDisplayStatus] = useState(booking.status);

  useEffect(() => {
    setDisplayStatus(booking.status);
    setCodeVerified(Boolean(booking.code_verified));
  }, [booking.status, booking.code_verified]);

  const onVerified = useCallback(() => {
    setCodeVerified(true);
    setShowVerification(false);
  }, []);

  useBookingVerificationSubscription(booking.id, onVerified);

  const queueSilentRefresh = useCallback(() => {
    if (!user?.id) return;

    setTimeout(() => refreshUserBookingsSilent(user.id), 300);
  }, [refreshUserBookingsSilent, user?.id]);

  const policy = booking.policy;
  const isNoShow = Boolean(booking.no_show_marked_at);
  const cutoffLabel = policy
    ? format(new Date(policy.cancellationCutoffAt), "PPP p")
    : null;
  const travelStartLabel = policy ? format(new Date(policy.travelStartAt), "PPP p") : null;
  const hasActiveStatus = ACTIVE_STATUSES.has(displayStatus);

  const shouldShowVerification =
    !isNoShow &&
    !codeVerified &&
    (displayStatus === "pending_verification" || displayStatus === "confirmed") &&
    (booking.payment_status === "completed" ||
      booking.payment_status === "partial" ||
      booking.payment_status === "partial_refund");

  const canCancel =
    hasActiveStatus && !codeVerified && !isNoShow && (policy ? policy.canCancel : true);

  const canReduceSeats =
    (booking.payment_status === "completed" ||
      booking.payment_status === "partial_refund") &&
    booking.seats > 1 &&
    !isNoShow &&
    (policy ? policy.canReduceSeats : canCancel);

  const canAddSeats =
    hasActiveStatus &&
    !codeVerified &&
    !isNoShow &&
    booking.ride.status !== "cancelled" &&
    booking.ride.seats_available > 0;

  const showCutoffHint = Boolean(policy && hasActiveStatus && policy.canCancel && cutoffLabel);
  const showLateWindowHint = Boolean(
    policy &&
      hasActiveStatus &&
      !isNoShow &&
      policy.blockReason === "late_window" &&
      cutoffLabel &&
      travelStartLabel
  );

  const toggleVerification = useCallback(() => {
    setShowVerification((current) => !current);
  }, []);

  const openReduceSeatsDialog = useCallback(() => {
    setShowReduceSeatsDialog(true);
  }, []);

  const closeReduceSeatsDialog = useCallback(() => {
    setShowReduceSeatsDialog(false);
  }, []);

  const openAddSeatsDialog = useCallback(() => {
    setShowAddSeatsDialog(true);
  }, []);

  const closeAddSeatsDialog = useCallback(() => {
    setShowAddSeatsDialog(false);
  }, []);

  const closeChat = useCallback(() => {
    setSelectedChatRide(null);
  }, []);

  const handleCancelBooking = useCallback(async () => {
    if (!canCancel) return;

    try {
      setIsCancelling(true);

      const data = await bookingApiClient.cancelBooking(booking.id);

      if (!data.success) {
        const message =
          data.errorCode === "CODE_VERIFIED_NO_CANCEL"
            ? t("pages.bookings.card.errors.codeVerifiedNoCancel")
            : data.errorCode === "LATE_CANCELLATION_LOCKED"
              ? t("pages.bookings.card.errors.lateCancellationLocked")
              : data.error || t("pages.bookings.card.cancelDescription", { seats: booking.seats });
        throw new Error(message);
      }

      setDisplayStatus("cancelled");

      if (data.refundInitiated && data.refundAmount) {
        toast({
          title: t("pages.bookings.card.cancelledSuccess"),
          description: t("pages.bookings.card.cancelledSuccessWithRefund", {
            amount: data.refundAmount.toLocaleString(),
            currency: payment?.currency || "XAF",
          }),
          duration: 6000,
        });
      } else {
        toast({
          title: t("pages.bookings.card.cancelledSuccess"),
          description: t("pages.bookings.card.cancelledSuccessNoRefund"),
          duration: 5000,
        });
      }

      queueSilentRefresh();
    } catch (error) {
      console.error("Error cancelling booking:", error);

      const message = (() => {
        if (error instanceof ApiError) {
          const code = (error.data as { errorCode?: string } | undefined)?.errorCode;
          if (code === "CODE_VERIFIED_NO_CANCEL") {
            return t("pages.bookings.card.errors.codeVerifiedNoCancel");
          }
          if (code === "LATE_CANCELLATION_LOCKED") {
            return t("pages.bookings.card.errors.lateCancellationLocked");
          }
          return error.getDisplayMessage();
        }

        return error instanceof Error
          ? error.message
          : t("pages.bookings.card.cancelDescription", { seats: booking.seats });
      })();

      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setIsCancelling(false);
    }
  }, [booking.id, booking.seats, canCancel, payment?.currency, queueSilentRefresh, t, toast]);

  const handleReduceSeats = useCallback(async () => {
    if (!newSeats || !canReduceSeats) return;

    const seatsToKeep = Number.parseInt(newSeats, 10);
    if (seatsToKeep >= booking.seats) {
      toast({
        title: t("common.error"),
        description: t("pages.bookings.card.errors.invalidReducedSeats"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsReducingSeats(true);

      const data = await bookingApiClient.reduceBookingSeats(booking.id, seatsToKeep);

      if (!data.success) {
        const message =
          data.errorCode === "CODE_VERIFIED_NO_REDUCE"
            ? t("pages.bookings.card.errors.codeVerifiedNoReduce")
            : data.errorCode === "LATE_SEAT_REDUCTION_LOCKED"
              ? t("pages.bookings.card.errors.lateSeatReductionLocked")
              : data.error || t("pages.bookings.card.cancelDescription", { seats: booking.seats });
        throw new Error(message);
      }

      toast({
        title: t("pages.bookings.card.seatsReducedSuccess"),
        description: t("pages.bookings.card.seatsReducedSuccessWithRefund", {
          seatsRemoved: data.seatsRemoved,
          amount: data.refundAmount?.toLocaleString() || "0",
          currency: payment?.currency || "XAF",
        }),
        duration: 6000,
      });

      setShowReduceSeatsDialog(false);
      queueSilentRefresh();
    } catch (error) {
      console.error("Error reducing seats:", error);

      const message = (() => {
        if (error instanceof ApiError) {
          const code = (error.data as { errorCode?: string } | undefined)?.errorCode;
          if (code === "CODE_VERIFIED_NO_REDUCE") {
            return t("pages.bookings.card.errors.codeVerifiedNoReduce");
          }
          if (code === "LATE_SEAT_REDUCTION_LOCKED") {
            return t("pages.bookings.card.errors.lateSeatReductionLocked");
          }
          return error.getDisplayMessage();
        }

        return error instanceof Error
          ? error.message
          : t("pages.bookings.card.cancelDescription", { seats: booking.seats });
      })();

      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setIsReducingSeats(false);
    }
  }, [booking.id, booking.seats, canReduceSeats, newSeats, payment?.currency, queueSilentRefresh, t, toast]);

  const handleOpenChat = useCallback(async () => {
    if (!user) {
      toast({
        title: t("common.error"),
        description: t("pages.bookings.card.errors.loginRequiredToContact"),
        variant: "destructive",
      });
      router.replace("/auth?redirect=/bookings");
      return;
    }

    if (!booking.ride.driver_id) {
      toast({
        title: t("common.error"),
        description: t("pages.bookings.card.errors.driverUnavailable"),
        variant: "destructive",
      });
      return;
    }

    const conversation = conversations.find(
      (conv) =>
        conv.rideId === booking.ride.id &&
        conv.otherUserId === booking.ride.driver_id
    );

    setSelectedChatRide({
      ride: booking.ride,
      conversationId: conversation?.id || booking.ride.id,
    });
  }, [booking.ride, conversations, router, t, toast, user]);

  const handleAddSeatsComplete = useCallback(() => {
    setShowAddSeatsDialog(false);
    queueSilentRefresh();
  }, [queueSilentRefresh]);

  return {
    payment,
    isCompleted,
    showVerification,
    toggleVerification,
    isCancelling,
    codeVerified,
    selectedChatRide,
    closeChat,
    showReduceSeatsDialog,
    openReduceSeatsDialog,
    closeReduceSeatsDialog,
    showAddSeatsDialog,
    openAddSeatsDialog,
    closeAddSeatsDialog,
    newSeats,
    setNewSeats,
    isReducingSeats,
    displayStatus,
    isNoShow,
    cutoffLabel,
    travelStartLabel,
    shouldShowVerification,
    canCancel,
    canReduceSeats,
    canAddSeats,
    showCutoffHint,
    showLateWindowHint,
    handleCancelBooking,
    handleReduceSeats,
    handleOpenChat,
    handleAddSeatsComplete,
  };
}
