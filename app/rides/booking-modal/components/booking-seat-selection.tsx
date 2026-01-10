"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MapPin, Users, Clock, Car, ArrowRight, Loader2, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";
import type { RideWithDriver } from "@/types";
import { useLocale } from "@/hooks";

interface BookingSeatSelectionProps {
  ride: RideWithDriver;
  seats: number;
  existingBooking: any;
  totalPrice: number;
  isCreatingBooking: boolean;
  bookingError: string | null;
  onSeatsChange: (seats: number) => void;
  onCreateBooking: () => void;
  onClose: () => void;
  onErrorClear: () => void;
}

export function BookingSeatSelection({
  ride,
  seats,
  existingBooking,
  totalPrice,
  isCreatingBooking,
  bookingError,
  onSeatsChange,
  onCreateBooking,
  onClose,
  onErrorClear,
}: BookingSeatSelectionProps) {
  const { t } = useLocale();

  // TEMPORARY DEBUG: Log existingBooking and calculated values
  useEffect(() => {
    console.log('🔍 [BookingSeatSelection] existingBooking:', existingBooking);
    console.log('🔍 [BookingSeatSelection] ride.seats_available:', ride.seats_available);
    console.log('🔍 [BookingSeatSelection] seats:', seats);
  }, [existingBooking, ride.seats_available, seats]);

  // Calculate maximum seats user can book (accounting for existing booking)
  // ADD DEFENSIVE CHECKS
  const maxSeats = existingBooking && typeof existingBooking.seats === 'number' && existingBooking.seats > 0
    ? ride.seats_available + existingBooking.seats  // User can "release and reallocate" their existing seats
    : ride.seats_available;                          // No existing booking, standard maximum

  // Calculate minimum seats user can book (can't reduce paid bookings)
  const minSeats = existingBooking && existingBooking.payment_status === 'completed' && typeof existingBooking.seats === 'number'
    ? existingBooking.seats  // Can't reduce seats below what's already paid
    : 1;                      // Standard minimum

  // TEMPORARY DEBUG: Log calculated values
  console.log('🔍 [BookingSeatSelection] maxSeats:', maxSeats, '| minSeats:', minSeats, '| existingBooking.seats:', existingBooking?.seats);

  // Parse error message to extract seats number if it's the "already have seats booked" error
  const parseBookingError = (error: string | null): { type: 'alreadyPaid' | 'other'; seats?: number; message: string } | null => {
    if (!error) return null;

    // Check if error matches pattern: "You already have X seat(s) booked and paid..."
    // Handle both "seat(s)" and "seat" or "seats" variations
    const alreadyPaidPattern = /You already have (\d+) seat\(s\) booked and paid for this ride/i;
    const match = error.match(alreadyPaidPattern);
    
    if (match) {
      const bookedSeats = parseInt(match[1], 10);
      return {
        type: 'alreadyPaid',
        seats: bookedSeats,
        message: error
      };
    }

    // Fallback: Check for general "already have" + "seat" pattern and extract number
    if (error.toLowerCase().includes('already have') && error.toLowerCase().includes('seat')) {
      // Try to extract the first number from the error message
      const generalPattern = /already have (\d+)/i;
      const numberMatch = error.match(generalPattern);
      if (numberMatch) {
        return {
          type: 'alreadyPaid',
          seats: parseInt(numberMatch[1], 10),
          message: error
        };
      }
    }

    // For any other error, return as-is
    return {
      type: 'other',
      message: error
    };
  };

  const parsedError = parseBookingError(bookingError);

  return (
    <>
      <div className="space-y-6">
        {/* Display booking error if present */}
        {parsedError && (
          <Alert variant="destructive" className="relative pr-10">
            <AlertCircle className="h-4 w-4" />
            {parsedError.type === 'alreadyPaid' && parsedError.seats ? (
              <>
                <AlertTitle>{t("pages.rides.booking.seatSelection.errors.alreadyPaidTitle")}</AlertTitle>
                <AlertDescription>
                  {t("pages.rides.booking.seatSelection.errors.alreadyPaidMessage", { 
                    seats: parsedError.seats
                  })}
                </AlertDescription>
              </>
            ) : (
              <>
                <AlertTitle>{t("pages.rides.booking.seatSelection.errors.genericError")}</AlertTitle>
                <AlertDescription>{parsedError.message}</AlertDescription>
              </>
            )}
            <button
              onClick={onErrorClear}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        )}

        {existingBooking && !parsedError && (
          <div className={`border rounded-lg p-3 ${
            existingBooking.payment_status === 'completed'
              ? 'bg-green-50 border-green-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            {existingBooking.payment_status === 'completed' ? (
              <p className="text-sm text-green-800">
                <strong>{t("pages.rides.booking.seatSelection.alreadyPaid")}</strong> {t("pages.rides.booking.seatSelection.alreadyPaidDesc", { seats: existingBooking.seats })}
              </p>
            ) : (
              <p className="text-sm text-blue-800">
                <strong>{t("pages.rides.booking.seatSelection.modifyBooking")}</strong> {t("pages.rides.booking.seatSelection.modifyBookingDesc")}
              </p>
            )}
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
                {ride.estimated_duration || "N/A"}h
              </div>
              <div className="flex items-center">
                <Users className="mr-1 h-4 w-4" />
                {ride.seats_available} {t("pages.rides.booking.seatSelection.seatsAvailable")}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seats">{t("pages.rides.booking.seatSelection.seats")}</Label>
          <Input
            id="seats"
            type="number"
            min={minSeats}
            max={maxSeats}
            value={seats}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value) && value >= 0) {
                onSeatsChange(value);
              }
              // Clear error when user changes seats
              if (bookingError) {
                onErrorClear();
              }
            }}
          />
          {existingBooking && existingBooking.payment_status === 'completed' && (
            <p className="text-xs text-muted-foreground">
              {t("pages.rides.booking.seatSelection.cannotReduce")}
            </p>
          )}
          {existingBooking && (
            <p className="text-xs text-muted-foreground">
              {t("pages.rides.booking.seatSelection.maxSeatsExplanation", {
                max: maxSeats,
                available: ride.seats_available,
                your: existingBooking.seats
              })}
            </p>
          )}
        </div>

        <div className="flex justify-between items-center text-lg font-semibold">
          <span>
            {existingBooking && existingBooking.payment_status === 'completed'
              ? t("pages.rides.booking.seatSelection.additionalPrice")
              : t("pages.rides.booking.seatSelection.totalPrice")}
          </span>
          <span className="text-primary">{totalPrice.toLocaleString()} FCFA</span>
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <Button onClick={onClose} variant="outline">
          {t("pages.rides.booking.seatSelection.cancel")}
        </Button>
        <Button
          onClick={onCreateBooking}
          disabled={seats < minSeats || seats > maxSeats || isCreatingBooking}
        >
          {isCreatingBooking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {existingBooking ? t("pages.rides.booking.seatSelection.updating") : t("pages.rides.booking.seatSelection.creating")}
            </>
          ) : (
            <>
              {existingBooking ? t("pages.rides.booking.seatSelection.updateAndContinue") : t("pages.rides.booking.seatSelection.continueToPayment")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}

