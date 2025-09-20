"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, RefreshCw, Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { RideWithPassengers, Passenger, RideWithDetails } from "@/types";
import { useDriverStore } from "@/stores/driverStore";
import { ApiError } from "@/lib/api-client";

interface ReservationsTabProps {
  onOpenChat: (ride: RideWithDetails, user: { id: string; full_name: string; avatar_url?: string }) => void;
}

export function ReservationsTab({ onOpenChat }: ReservationsTabProps) {
  const { toast } = useToast();
  const {
    reservations,
    reservationsLoading,
    reservationsError,
    fetchReservations,
    refreshReservations,
  } = useDriverStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Handle errors from the store
  useEffect(() => {
    if (reservationsError) {
      let errorMessage = "Impossible de charger les réservations";
      
      if (reservationsError.includes("Authentication")) {
        toast({
          title: "Session expirée",
          description: "Veuillez vous reconnecter pour continuer",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [reservationsError, toast]);

  // Filter and sort rides
  const filteredAndSortedRides = useMemo(() => {
    let filtered = reservations;

    // Filter by search query
    if (searchQuery) {
      filtered = reservations.filter((ride) =>
        ride.from_city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ride.to_city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ride.passengers.some((passenger) =>
          passenger.full_name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Sort by departure date
    return filtered.sort((a, b) => {
      const dateA = new Date(`${a.departure_date} ${a.departure_time}`);
      const dateB = new Date(`${b.departure_date} ${b.departure_time}`);
      return sortOrder === "asc" ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });
  }, [reservations, searchQuery, sortOrder]);

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Get payment status badge variant
  const getPaymentBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (reservationsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Chargement des réservations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Rechercher par ville ou passager..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            <Calendar className="h-4 w-4 mr-1" />
            {sortOrder === "asc" ? "Plus ancien" : "Plus récent"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshReservations}
            disabled={reservationsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${reservationsLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Rides list */}
      <div className="space-y-4">
        {filteredAndSortedRides.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Aucune réservation trouvée
              </h3>
              <p className="text-gray-500">
                {searchQuery
                  ? "Aucune réservation ne correspond à votre recherche."
                  : "Vous n'avez pas encore de réservations pour vos trajets."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedRides.map((ride) => (
            <Card key={ride.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">
                        {ride.from_city} → {ride.to_city}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {ride.departure_time ? format(new Date(ride.departure_time), "PPP 'à' p", { locale: fr }) : "Date non disponible"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {ride.passengers.length} passager(s)
                    </p>
                    <p className="text-sm font-medium">
                      {ride.price_per_seat ? ride.price_per_seat.toLocaleString() : '0'} FCFA par place
                    </p>
                  </div>
                </div>
              </CardHeader>

              {ride.passengers.length > 0 && (
                <>
                  <Separator />
                  <CardContent className="pt-4">
                    <h4 className="font-semibold mb-3 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Passagers ({ride.passengers.length})
                    </h4>
                    <div className="space-y-3">
                      {ride.passengers.map((passenger) => (
                        <div
                          key={passenger.booking_id}
                          className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={passenger.avatar_url} />
                              <AvatarFallback>
                                {passenger.full_name
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{passenger.full_name}</p>
                                {passenger._profileError && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                    ⚠️ Profil indisponible
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                {passenger.seats} place(s) • Réservé le{" "}
                                {format(new Date(passenger.booking_created_at), "dd/MM/yyyy", { locale: fr })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getStatusBadgeVariant(passenger.status)}>
                              {passenger.status}
                            </Badge>
                            <Badge variant={getPaymentBadgeVariant(passenger.payment_status)}>
                              {passenger.payment_status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onOpenChat(
                                  {
                                    id: ride.id,
                                    driver_id: "", // Will be set by the parent component
                                    from_city: ride.from_city,
                                    to_city: ride.to_city,
                                    departure_time: ride.departure_time,
                                    price: ride.price_per_seat,
                                    seats_available: ride.available_seats,
                                    car_model: "", // Not available in reservations data
                                    car_color: "", // Not available in reservations data
                                    created_at: ride.created_at,
                                    updated_at: ride.created_at, // Use created_at as fallback
                                    bookings: [], // Not needed for chat context
                                    messages: [], // Not needed for chat context
                                  },
                                  {
                                    id: passenger.user_id,
                                    full_name: passenger.full_name,
                                    avatar_url: passenger.avatar_url,
                                  }
                                )
                              }
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              Chat
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
