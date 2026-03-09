"use client";

import { MessageCircle, Minus, Plus, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  CardFooter,
} from "@/components/ui";
import { useLocale } from "@/hooks";

import type { BookingWithPayments } from "@/types";

interface BookingCardActionsProps {
  booking: BookingWithPayments;
  isNoShow: boolean;
  codeVerified: boolean;
  canAddSeats: boolean;
  canReduceSeats: boolean;
  canCancel: boolean;
  isCancelling: boolean;
  onOpenChat: () => void;
  onOpenAddSeats: () => void;
  onOpenReduceSeats: () => void;
  onCancelBooking: () => void;
}

export function BookingCardActions({
  booking,
  isNoShow,
  codeVerified,
  canAddSeats,
  canReduceSeats,
  canCancel,
  isCancelling,
  onOpenChat,
  onOpenAddSeats,
  onOpenReduceSeats,
  onCancelBooking,
}: BookingCardActionsProps) {
  const { t } = useLocale();

  return (
    <CardFooter className="flex flex-col gap-3">
      {isNoShow ? (
        <p className="w-full text-sm text-muted-foreground">
          {t("pages.bookings.card.noShowRecorded")}
        </p>
      ) : codeVerified ? (
        <p className="w-full text-sm text-muted-foreground">
          {t("pages.bookings.card.tripConfirmedNoChanges")}
        </p>
      ) : null}

      <div className="flex w-full flex-wrap justify-end gap-2">
        {booking.ride.driver_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenChat}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            {t("pages.bookings.card.contact")}
          </Button>
        )}

        {canAddSeats && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAddSeats}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("pages.bookings.card.addSeats")}
          </Button>
        )}

        {canReduceSeats && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenReduceSeats}
            className="flex items-center gap-2"
          >
            <Minus className="h-4 w-4" />
            {t("pages.bookings.card.reduceSeats")}
          </Button>
        )}

        {canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isCancelling}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                {isCancelling
                  ? t("pages.bookings.card.cancelling")
                  : t("pages.bookings.card.cancel")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("pages.bookings.card.cancelTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("pages.bookings.card.cancelDescription", { seats: booking.seats })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("pages.bookings.card.keepBooking")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onCancelBooking}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("pages.bookings.card.confirmCancel")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {booking.receipt && (
          <Button variant="outline" asChild>
            <a
              href={`/receipts/${booking.receipt.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("pages.bookings.card.viewReceipt")}
            </a>
          </Button>
        )}
      </div>
    </CardFooter>
  );
}
