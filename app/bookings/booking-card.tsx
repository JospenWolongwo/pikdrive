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
import { format } from "date-fns";
import { VerificationCodeDisplay } from "@/components/bookings/verification-code-display";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, X, MessageCircle, Minus } from "lucide-react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chatStore";
import { ChatDialog } from "@/components/chat/chat-dialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/hooks";

import type { BookingWithPayments } from '@/types';
import type { RideWithDriver } from '@/types/ride';


interface BookingCardProps {
  booking: BookingWithPayments;
}

export function BookingCard({ booking }: BookingCardProps) {
  const { t } = useLocale();
  const payment = booking.payments?.[0];
  const isCompleted =
    payment?.payment_time && payment?.metadata?.financialTransactionId;
  const [showVerification, setShowVerification] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [codeVerified, setCodeVerified] = useState(booking.code_verified || false);
  const [selectedChatRide, setSelectedChatRide] = useState<{
    ride: RideWithDriver;
    conversationId: string;
  } | null>(null);
  const [showReduceSeatsDialog, setShowReduceSeatsDialog] = useState(false);
  const [newSeats, setNewSeats] = useState<string>("");
  const [isReducingSeats, setIsReducingSeats] = useState(false);
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const { conversations } = useChatStore();

  // Set up real-time subscription for code_verified changes
  useEffect(() => {
    const subscription = supabase
      .channel(`booking-verification-${booking.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${booking.id}`,
        },
        (payload: any) => {
          if (payload.new?.code_verified === true && payload.old?.code_verified !== true) {
            setCodeVerified(true);
            // Hide verification section when verified
            setShowVerification(false);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [booking.id, supabase]);

  // Determine if we should show verification code
  // Hide if code is already verified
  const shouldShowVerification =
    !codeVerified &&
    (booking.status === "pending_verification" ||
      booking.status === "confirmed") &&
    booking.payment_status === "completed";

  // Determine if booking can be cancelled
  const canCancel = ["pending", "confirmed", "pending_verification"].includes(
    booking.status
  );

  // Determine if booking can have seats reduced (paid booking with > 1 seat)
  const canReduceSeats = 
    booking.payment_status === "completed" && 
    booking.seats > 1 && 
    canCancel;

  // Handle booking cancellation
  const handleCancelBooking = async () => {
    if (!canCancel) return;

    try {
      setIsCancelling(true);

      // Use the DELETE API endpoint which handles atomic cancellation with refunds
      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Cancellation failed");
      }

      // Show success message with refund information if applicable
      if (data.refundInitiated && data.refundAmount) {
        const refundAmount = data.refundAmount.toLocaleString();
        const currency = payment?.currency || "XAF";
        
        toast({
          title: t("pages.bookings.card.cancelledSuccess"),
          description: t("pages.bookings.card.cancelledSuccessWithRefund", {
            amount: refundAmount,
            currency,
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

      // Refresh the page to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1500); // Give user time to see the success message
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error 
          ? error.message 
          : t("pages.bookings.card.cancelDescription", { seats: booking.seats }),
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle reducing seats
  const handleReduceSeats = async () => {
    if (!newSeats || !canReduceSeats) return;

    const seatsToKeep = parseInt(newSeats);
    if (seatsToKeep >= booking.seats) {
      toast({
        title: "Erreur",
        description: "Le nombre de places doit être inférieur au nombre actuel.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsReducingSeats(true);

      const response = await fetch(`/api/bookings/${booking.id}/reduce-seats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSeats: seatsToKeep }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to reduce seats");
      }

      // Show success message with refund information
      const refundAmount = data.refundAmount?.toLocaleString() || "0";
      const currency = payment?.currency || "XAF";
      
      toast({
        title: t("pages.bookings.card.seatsReducedSuccess"),
        description: t("pages.bookings.card.seatsReducedSuccessWithRefund", {
          seatsRemoved: data.seatsRemoved,
          amount: refundAmount,
          currency,
        }),
        duration: 6000,
      });

      // Close dialog and refresh after showing success message
      setShowReduceSeatsDialog(false);
      setTimeout(() => {
        window.location.reload();
      }, 1500); // Give user time to see the success message
    } catch (error) {
      console.error("Error reducing seats:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error 
          ? error.message 
          : t("pages.bookings.card.cancelDescription", { seats: booking.seats }),
        variant: "destructive",
      });
    } finally {
      setIsReducingSeats(false);
    }
  };

  // Handle opening chat with driver
  const handleOpenChat = async () => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour contacter le conducteur.",
        variant: "destructive",
      });
      router.replace("/auth?redirect=/bookings");
      return;
    }

    if (!booking.ride.driver_id) {
      toast({
        title: "Erreur",
        description: "Informations du chauffeur non disponibles.",
        variant: "destructive",
      });
      return;
    }

    // Find the conversation for this ride and driver
    const conversation = conversations.find(
      (conv) =>
        conv.rideId === booking.ride.id &&
        conv.otherUserId === booking.ride.driver_id
    );

    if (conversation) {
      setSelectedChatRide({
        ride: booking.ride as RideWithDriver,
        conversationId: conversation.id,
      });
    } else {
      // If no conversation exists, use the rideId as a fallback and let the ChatDialog handle creation
      setSelectedChatRide({
        ride: booking.ride as RideWithDriver,
        conversationId: booking.ride.id,
      });
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
            <strong>{t("pages.bookings.card.driver")}</strong> {booking.ride.driver?.full_name || t("pages.bookings.card.notAvailable")}
          </div>
          <div>
            <strong>{t("pages.bookings.card.car")}</strong> {booking.ride.car_model || t("pages.bookings.card.notSpecified")} (
            {booking.ride.car_color || t("pages.bookings.card.notSpecified")})
          </div>
          <div>
            <strong>{t("pages.bookings.card.seats")}</strong> {booking.seats}
          </div>
          {booking.pickup_point_name && (
            <div>
              <strong>{t("pages.bookings.card.pickupPoint")}</strong> {booking.pickup_point_name}
              {booking.pickup_time && (
                <span className="text-muted-foreground text-sm ml-2">
                  ({format(new Date(booking.pickup_time), "h:mm a")})
                </span>
              )}
            </div>
          )}
          <div>
            <strong>{t("pages.bookings.card.total")}</strong>{" "}
            {payment 
              ? `${payment.amount} ${payment.currency}` 
              : booking.ride?.price 
                ? `${(booking.seats * booking.ride.price).toLocaleString()} FCFA`
                : "N/A"}
          </div>
          <div>
            <strong>{t("pages.bookings.card.status")}</strong>{" "}
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
                ? t("pages.bookings.card.statusConfirmed")
                : booking.status === "pending"
                ? t("pages.bookings.card.statusPending")
                : booking.status === "cancelled"
                ? t("pages.bookings.card.statusCancelled")
                : booking.status === "pending_verification"
                ? t("pages.bookings.card.statusPendingVerification")
                : booking.status}
            </span>
          </div>
          {payment && (
            <div>
              <strong>{t("pages.bookings.card.payment")}</strong>{" "}
              <span
                className={`inline-block px-2 py-1 text-sm rounded-full ${
                  isCompleted
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {isCompleted ? t("pages.bookings.card.paymentCompleted") : t("pages.bookings.card.paymentPending")}
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
                  {showVerification ? t("pages.bookings.card.hideCode") : t("pages.bookings.card.showCode")}
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
        {booking.ride.driver_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenChat}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            {t("pages.bookings.card.contact")}
          </Button>
        )}

        {canReduceSeats && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReduceSeatsDialog(true)}
            className="flex items-center gap-2"
          >
            <Minus className="h-4 w-4" />
            Réduire places
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
                {isCancelling ? t("pages.bookings.card.cancelling") : t("pages.bookings.card.cancel")}
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
                <AlertDialogCancel>
                  {t("pages.bookings.card.keepBooking")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelBooking}
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
      </CardFooter>

      <Dialog open={showReduceSeatsDialog} onOpenChange={setShowReduceSeatsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réduire le nombre de places</DialogTitle>
            <DialogDescription>
              Sélectionnez le nombre de places que vous souhaitez conserver. 
              La différence vous sera remboursée sur le {payment?.phone_number || "numéro de paiement"}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="block text-sm font-medium mb-2">
              Places actuelles: {booking.seats}
            </label>
            <Select value={newSeats} onValueChange={setNewSeats}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez le nombre de places à conserver" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: booking.seats - 1 }, (_, i) => i + 1).map(n => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} place{n > 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {newSeats && (
              <p className="mt-4 text-sm text-muted-foreground">
                Montant du remboursement: {((booking.seats - parseInt(newSeats)) * (booking.ride?.price || 0)).toLocaleString()} XAF
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReduceSeatsDialog(false)}
              disabled={isReducingSeats}
            >
              Annuler
            </Button>
            <Button
              onClick={handleReduceSeats}
              disabled={!newSeats || isReducingSeats}
            >
              {isReducingSeats ? "En cours..." : "Confirmer la réduction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedChatRide && (
        <ChatDialog
          isOpen={!!selectedChatRide}
          onClose={() => setSelectedChatRide(null)}
          rideId={selectedChatRide.ride.id}
          conversationId={selectedChatRide.conversationId}
          otherUserId={selectedChatRide.ride.driver_id}
          otherUserName={selectedChatRide.ride.driver?.full_name || t("pages.bookings.card.driver").replace(":", "")}
          otherUserAvatar={selectedChatRide.ride.driver?.avatar_url}
        />
      )}
    </Card>
  );
}
