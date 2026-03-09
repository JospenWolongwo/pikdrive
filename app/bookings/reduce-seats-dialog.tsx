"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { useLocale } from "@/hooks";

interface ReduceSeatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSeats: number;
  ridePrice?: number;
  paymentPhoneNumber?: string;
  newSeats: string;
  onNewSeatsChange: (value: string) => void;
  isReducingSeats: boolean;
  onConfirm: () => void;
}

export function ReduceSeatsDialog({
  open,
  onOpenChange,
  currentSeats,
  ridePrice,
  paymentPhoneNumber,
  newSeats,
  onNewSeatsChange,
  isReducingSeats,
  onConfirm,
}: ReduceSeatsDialogProps) {
  const { t } = useLocale();
  const selectedSeats = Number.parseInt(newSeats, 10);
  const refundAmount = Number.isNaN(selectedSeats)
    ? 0
    : (currentSeats - selectedSeats) * (ridePrice || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pages.bookings.card.reduceSeatsTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.bookings.card.reduceSeatsDescription", {
              phoneNumber:
                paymentPhoneNumber || t("pages.bookings.card.paymentNumberFallback"),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="mb-2 block text-sm font-medium">
            {t("pages.bookings.card.currentSeats", { seats: currentSeats })}
          </label>
          <Select value={newSeats} onValueChange={onNewSeatsChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("pages.bookings.card.reduceSeatsPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: currentSeats - 1 }, (_, index) => index + 1).map((seatCount) => (
                <SelectItem key={seatCount} value={seatCount.toString()}>
                  {seatCount}{" "}
                  {seatCount > 1
                    ? t("pages.rides.booking.seatSelection.places")
                    : t("pages.rides.booking.seatSelection.place")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {newSeats && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("pages.bookings.card.refundAmount", {
                amount: refundAmount.toLocaleString(),
                currency: "XAF",
              })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isReducingSeats}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={!newSeats || isReducingSeats}>
            {isReducingSeats
              ? t("pages.bookings.card.reducingSeats")
              : t("pages.bookings.card.confirmReduceSeats")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
