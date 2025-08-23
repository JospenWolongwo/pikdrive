import { useState } from "react";
import { format } from "date-fns";
import {
  MapPin,
  Calendar,
  Users,
  MessageCircle,
  Shield,
  RefreshCw,
  Check,
  Edit,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { Ride, Booking } from "./types";

interface RideCardProps {
  ride: Ride;
  onOpenChat: (
    ride: Ride,
    user: { id: string; full_name: string; avatar_url?: string }
  ) => void;
  onVerifyCode: (bookingId: string) => void;
  onCheckPayment: (booking: {
    id: string;
    transaction_id?: string;
    payment_provider?: string;
  }) => void;
  onDeleteRide?: (rideId: string) => void;
  isPastRide?: boolean;
}

// Utility function for determining status colors
const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "confirmed":
      return "bg-green-500";
    case "pending":
      return "bg-yellow-500";
    case "pending_verification":
      return "bg-purple-500";
    case "cancelled":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

export function RideCard({
  ride,
  onOpenChat,
  onVerifyCode,
  onCheckPayment,
  onDeleteRide,
  isPastRide = false,
}: RideCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmedPassengers = ride.bookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + b.seats, 0);

  // Helper function to check if ride can be deleted
  const canDeleteRide = () => {
    return !ride.bookings.some(
      (b) =>
        b.status === "confirmed" ||
        b.status === "pending" ||
        b.status === "pending_verification" ||
        b.payment_status === "completed" ||
        b.payment_status === "paid"
    );
  };

  const handleDeleteRide = async (rideId: string) => {
    if (isDeleting) return;

    // Double-check if ride can be deleted
    if (!canDeleteRide()) {
      return;
    }

    try {
      setIsDeleting(true);
      if (onDeleteRide) {
        await onDeleteRide(rideId);
      } else {
        // Fallback: redirect to delete page
        if (confirm("Êtes-vous sûr de vouloir supprimer ce trajet ?")) {
          window.location.href = `/driver/rides/${rideId}`;
        }
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {ride.from_city} vers {ride.to_city}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(ride.departure_time), "PPP p")}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="font-semibold">
                {ride.price.toLocaleString()} FCFA
              </div>
              <div className="text-sm text-muted-foreground">
                {isPastRide
                  ? `${confirmedPassengers} passagers`
                  : `${ride.seats_available} places disponibles`}
              </div>
            </div>

            {/* Ride Management Buttons - Only show for upcoming rides */}
            {!isPastRide && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    (window.location.href = `/driver/rides/${ride.id}`)
                  }
                  className="flex items-center gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Modifier
                </Button>

                {/* Show warning if ride cannot be deleted */}
                {!canDeleteRide() && (
                  <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    ⚠️{" "}
                    {(() => {
                      const hasPaidBookings = ride.bookings.some(
                        (b) =>
                          b.payment_status === "completed" ||
                          b.payment_status === "paid"
                      );
                      const hasActiveBookings = ride.bookings.some(
                        (b) =>
                          b.status === "confirmed" ||
                          b.status === "pending" ||
                          b.status === "pending_verification"
                      );

                      if (hasPaidBookings) {
                        return "Paiements reçus";
                      } else if (hasActiveBookings) {
                        return "Réservations actives";
                      }
                      return "Réservations actives";
                    })()}
                  </div>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canDeleteRide()}
                      className={`flex items-center gap-1 ${
                        !canDeleteRide()
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-red-600 hover:text-red-700 hover:bg-red-50"
                      }`}
                      title={
                        !canDeleteRide()
                          ? "Impossible de supprimer un trajet avec des réservations actives"
                          : "Supprimer ce trajet"
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Êtes-vous sûr de vouloir supprimer ce trajet ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible et supprimera
                        définitivement ce trajet.
                        {(() => {
                          if (!canDeleteRide()) {
                            const paidBookings = ride.bookings.filter(
                              (b) =>
                                b.payment_status === "completed" ||
                                b.payment_status === "paid"
                            );
                            const activeBookings = ride.bookings.filter(
                              (b) =>
                                b.status === "confirmed" ||
                                b.status === "pending" ||
                                b.status === "pending_verification"
                            );

                            if (paidBookings.length > 0) {
                              return ` ⚠️ Ce trajet a ${paidBookings.length} réservation(s) payée(s) et ne peut pas être supprimé.`;
                            } else if (activeBookings.length > 0) {
                              return ` ⚠️ Ce trajet a ${activeBookings.length} réservation(s) active(s) et ne peut pas être supprimé.`;
                            }
                            return "";
                          }
                          return "";
                        })()}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteRide(ride.id)}
                        disabled={!canDeleteRide() || isDeleting}
                        className="bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Suppression...
                          </>
                        ) : (
                          "Supprimer"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isPastRide && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <strong>Voiture :</strong> {ride.car_model} ({ride.car_color})
            </div>
            <div>
              <strong>Places :</strong> {ride.seats_available}
            </div>
          </div>
        )}

        {ride.bookings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">
                {isPastRide ? "Passagers" : "Réservations"}
              </h4>

              {/* Show payment status indicator */}
              {(() => {
                const paidBookings = ride.bookings.filter(
                  (b) =>
                    b.payment_status === "completed" ||
                    b.payment_status === "paid"
                );
                if (paidBookings.length > 0) {
                  return (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      💰 {paidBookings.length} payé(s)
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
            <div className="space-y-2">
              {ride.bookings
                .filter((booking) =>
                  isPastRide ? booking.status === "confirmed" : true
                )
                .map((booking: Booking) => (
                  <div
                    key={booking.id}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      isPastRide ? "bg-muted" : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={booking.user?.avatar_url || undefined}
                          alt={booking.user?.full_name || "User"}
                        />
                        <AvatarFallback>
                          {booking.user?.full_name?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {booking.user?.full_name}
                          </p>
                          {!isPastRide && (
                            <Badge
                              className={`text-white ${getStatusColor(
                                booking.status
                              )}`}
                            >
                              {booking.status}
                            </Badge>
                          )}
                          {booking.code_verified && (
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1 bg-green-50"
                            >
                              <Check className="h-3 w-3 text-green-500" />
                              <span className="text-green-700">Vérifié</span>
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{booking.seats} places</span>
                          {!isPastRide && booking.payment_status && (
                            <Badge
                              variant={
                                booking.payment_status === "completed"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              Paiement:{" "}
                              {booking.payment_status === "completed"
                                ? "Terminé"
                                : "En attente"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isPastRide && (
                      <div className="flex items-center gap-2">
                        {/* Payment verification button */}
                        {booking.payment_status !== "completed" &&
                          booking.transaction_id &&
                          booking.payment_provider && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onCheckPayment({
                                  id: booking.id,
                                  transaction_id: booking.transaction_id,
                                  payment_provider: booking.payment_provider,
                                })
                              }
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Vérifier le paiement
                            </Button>
                          )}

                        {/* Code verification button */}
                        {!booking.code_verified &&
                          (booking.status === "pending_verification" ||
                            booking.status === "confirmed") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onVerifyCode(booking.id)}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Vérifier le code
                            </Button>
                          )}

                        {/* Chat button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenChat(ride, booking.user)}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Chat
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
