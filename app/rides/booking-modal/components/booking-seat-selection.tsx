"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Users, Clock, Car, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { RideWithDriver } from "@/types";

interface BookingSeatSelectionProps {
  ride: RideWithDriver;
  seats: number;
  existingBooking: any;
  totalPrice: number;
  isCreatingBooking: boolean;
  onSeatsChange: (seats: number) => void;
  onCreateBooking: () => void;
  onClose: () => void;
}

export function BookingSeatSelection({
  ride,
  seats,
  existingBooking,
  totalPrice,
  isCreatingBooking,
  onSeatsChange,
  onCreateBooking,
  onClose,
}: BookingSeatSelectionProps) {
  return (
    <>
      <div className="space-y-6">
        {existingBooking && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Modification de réservation :</strong> Vous avez déjà une réservation pour ce trajet. 
              Vous pouvez modifier le nombre de places ou procéder au paiement.
            </p>
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
                {ride.seats_available} places disponibles
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seats">Nombre de places</Label>
          <Input
            id="seats"
            type="number"
            min={1}
            max={ride.seats_available}
            value={seats}
            onChange={(e) => onSeatsChange(parseInt(e.target.value))}
          />
        </div>

        <div className="flex justify-between items-center text-lg font-semibold">
          <span>Prix total :</span>
          <span className="text-primary">{totalPrice.toLocaleString()} FCFA</span>
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <Button onClick={onClose} variant="outline">
          Annuler
        </Button>
        <Button
          onClick={onCreateBooking}
          disabled={seats < 1 || seats > ride.seats_available || isCreatingBooking}
        >
          {isCreatingBooking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {existingBooking ? "Mise à jour..." : "Création..."}
            </>
          ) : (
            <>
              {existingBooking ? "Mettre à jour et continuer au paiement" : "Continuer au paiement"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}

