"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { VerificationCodeDisplay } from "@/components/bookings/verification-code-display";
import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useToast } from "@/components/ui/use-toast";
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
} from "@/components/ui/alert-dialog";

interface Driver {
  full_name: string;
  avatar_url?: string;
}

interface Ride {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  car_model: string;
  car_color: string;
  price: number;
  driver: Driver;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  phone_number: string;
  transaction_id?: string;
  payment_time?: string;
  metadata?: {
    financialTransactionId?: string;
    [key: string]: any;
  };
  status?: string;
}

interface Booking {
  id: string;
  seats: number;
  status: string;
  payment_status: string;
  created_at: string;
  ride: Ride;
  payments?: Payment[];
  receipt?: {
    id: string;
    payment_id: string;
    created_at: string;
  };
}

interface BookingCardProps {
  booking: Booking;
}

export function BookingCard({ booking }: BookingCardProps) {
  const payment = booking.payments?.[0];
  const isCompleted =
    payment?.payment_time && payment?.metadata?.financialTransactionId;
  const [showVerification, setShowVerification] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { supabase } = useSupabase();
  const { toast } = useToast();

  // Determine if we should show verification code
  // Show for pending_verification status (new) as well as confirmed status bookings
  const shouldShowVerification =
    (booking.status === "pending_verification" ||
      booking.status === "confirmed") &&
    booking.payment_status === "completed";

  // Determine if booking can be cancelled
  const canCancel = ["pending", "confirmed", "pending_verification"].includes(
    booking.status
  );

  // Handle booking cancellation
  const handleCancelBooking = async () => {
    if (!canCancel) return;

    try {
      setIsCancelling(true);

      // Use the database function for atomic cancellation
      const { data, error } = await supabase.rpc(
        "cancel_booking_and_restore_seats",
        {
          p_booking_id: booking.id,
        }
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Cancellation failed");
      }

      toast({
        title: "Réservation annulée",
        description:
          "Votre réservation a été annulée avec succès et les places ont été libérées.",
      });

      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'annuler la réservation. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {booking.ride.from_city} → {booking.ride.to_city}
        </CardTitle>
        <CardDescription>
          {formatDate(booking.ride.departure_time)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <div>
            <strong>Chauffeur :</strong> {booking.ride.driver.full_name}
          </div>
          <div>
            <strong>Voiture :</strong> {booking.ride.car_model} (
            {booking.ride.car_color})
          </div>
          <div>
            <strong>Places :</strong> {booking.seats}
          </div>
          <div>
            <strong>Total :</strong>{" "}
            {payment ? `${payment.amount} ${payment.currency}` : "N/A"}
          </div>
          <div>
            <strong>Statut :</strong>{" "}
            <span
              className={`inline-block px-2 py-1 text-sm rounded-full ${
                booking.status === "confirmed"
                  ? "bg-green-100 text-green-800"
                  : booking.status === "pending"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {booking.status === "confirmed"
                ? "Confirmé"
                : booking.status === "pending"
                ? "En attente"
                : booking.status === "cancelled"
                ? "Annulé"
                : booking.status === "pending_verification"
                ? "En attente de vérification"
                : booking.status}
            </span>
          </div>
          {payment && (
            <div>
              <strong>Paiement :</strong>{" "}
              <span
                className={`inline-block px-2 py-1 text-sm rounded-full ${
                  isCompleted
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {isCompleted ? "Terminé" : "En attente"}
              </span>
            </div>
          )}

          {shouldShowVerification && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-between"
                onClick={() => setShowVerification(!showVerification)}
              >
                <span>
                  {showVerification ? "Masquer" : "Afficher"} le code de
                  vérification du chauffeur
                </span>
                {showVerification ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showVerification && (
                <div className="mt-4">
                  <VerificationCodeDisplay bookingId={booking.id} />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
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
                {isCancelling ? "Annulation..." : "Annuler la réservation"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler la réservation</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir annuler cette réservation ? Cette
                  action est irréversible et libérera {booking.seats} place
                  {booking.seats > 1 ? "s" : ""} sur le trajet.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  Non, garder la réservation
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelBooking}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Oui, annuler
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
              Voir le reçu
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
