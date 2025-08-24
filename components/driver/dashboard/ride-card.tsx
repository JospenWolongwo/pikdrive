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
    // A ride cannot be deleted if it has any bookings at all
    // This prevents deletion of rides that have been booked by passengers
    return ride.bookings.length === 0;
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
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      <CardHeader className="pb-4">
        {/* Mobile-first header layout */}
        <div className="space-y-4">
          {/* Route and time info - stacked on mobile */}
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="truncate">
                {ride.from_city} → {ride.to_city}
              </span>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {format(new Date(ride.departure_time), "PPP p")}
              </span>
            </CardDescription>
          </div>

          {/* Price and seats info - responsive layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="text-center sm:text-left">
                <div className="font-bold text-lg text-primary">
                  {ride.price.toLocaleString()} FCFA
                </div>
                <div className="text-sm text-muted-foreground">
                  {isPastRide
                    ? `${confirmedPassengers} passagers`
                    : `${ride.seats_available} places disponibles`}
                </div>
              </div>

              {/* Car info - compact on mobile */}
              {!isPastRide && (
                <div className="text-sm text-muted-foreground">
                  <div className="font-medium">{ride.car_model}</div>
                  <div className="text-xs">{ride.car_color}</div>
                </div>
              )}
            </div>

            {/* Ride Management Buttons - Responsive layout */}
            {!isPastRide && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    (window.location.href = `/driver/rides/${ride.id}`)
                  }
                  className="flex items-center gap-1 text-xs sm:text-sm"
                >
                  <Edit className="h-3 w-3" />
                  <span className="hidden sm:inline">Modifier</span>
                  <span className="sm:hidden">Modif</span>
                </Button>

                {/* Show warning if ride cannot be deleted */}
                {!canDeleteRide() && (
                  <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    ⚠️ {ride.bookings.length} réserv.
                  </div>
                )}

                {canDeleteRide() && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm"
                        title="Supprimer ce trajet"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Supprimer</span>
                        <span className="sm:hidden">Suppr</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Êtes-vous sûr de vouloir supprimer ce trajet ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible et supprimera
                          définitivement ce trajet.
                          {!canDeleteRide() &&
                            ` ⚠️ Ce trajet a ${ride.bookings.length} réservation(s) et ne peut pas être supprimé.`}
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
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {ride.bookings.length > 0 && (
          <div className="border-t pt-4">
            {/* Header with payment status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h4 className="font-semibold text-base">
                {isPastRide ? "Passagers" : "Réservations"} (
                {ride.bookings.length})
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
                      className="bg-green-50 text-green-700 border-green-200 text-xs"
                    >
                      💰 {paidBookings.length} payé(s)
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>

            {/* Bookings list - mobile-first design */}
            <div className="space-y-3">
              {ride.bookings
                .filter((booking) =>
                  isPastRide ? booking.status === "confirmed" : true
                )
                .map((booking: Booking) => (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-lg border bg-muted/50 ${
                      isPastRide ? "bg-muted/30" : "bg-muted/50"
                    }`}
                  >
                    {/* Mobile-first booking layout */}
                    <div className="space-y-3">
                      {/* User info row */}
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarImage
                            src={booking.user?.avatar_url || undefined}
                            alt={booking.user?.full_name || "User"}
                          />
                          <AvatarFallback className="text-sm">
                            {booking.user?.full_name?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">
                              {booking.user?.full_name || "Passager"}
                            </p>

                            {/* Status badges - compact on mobile */}
                            {!isPastRide && (
                              <Badge
                                className={`text-white text-xs px-2 py-1 ${getStatusColor(
                                  booking.status
                                )}`}
                              >
                                {booking.status === "pending" && "En attente"}
                                {booking.status === "pending_verification" &&
                                  "Vérif."}
                                {booking.status === "confirmed" && "Confirmé"}
                                {booking.status === "cancelled" && "Annulé"}
                              </Badge>
                            )}

                            {booking.code_verified && (
                              <Badge
                                variant="outline"
                                className="flex items-center gap-1 bg-green-50 text-xs px-2 py-1"
                              >
                                <Check className="h-3 w-3 text-green-500" />
                                <span className="text-green-700 hidden sm:inline">
                                  Vérifié
                                </span>
                                <span className="text-green-700 sm:hidden">
                                  ✓
                                </span>
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {booking.seats} place
                              {booking.seats > 1 ? "s" : ""}
                            </span>

                            {!isPastRide && booking.payment_status && (
                              <Badge
                                variant={
                                  booking.payment_status === "completed"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs px-2 py-1"
                              >
                                {booking.payment_status === "completed"
                                  ? "💳 Payé"
                                  : "⏳ En attente"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons - responsive layout */}
                      {!isPastRide && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
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
                                className="text-xs h-8 px-3"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                  Vérifier paiement
                                </span>
                                <span className="sm:hidden">
                                  Vérif. paiement
                                </span>
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
                                className="text-xs h-8 px-3"
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                  Vérifier code
                                </span>
                                <span className="sm:hidden">Vérif. code</span>
                              </Button>
                            )}

                          {/* Chat button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChat(ride, booking.user)}
                            className="text-xs h-8 px-3"
                          >
                            <MessageCircle className="h-5 w-5 mr-1" />
                            <span className="hidden sm:inline">Chat</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
