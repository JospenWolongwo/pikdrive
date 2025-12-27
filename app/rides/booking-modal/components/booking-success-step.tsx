"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";

interface BookingSuccessStepProps {
  paymentSuccess: boolean;
  onClose: () => void;
}

export function BookingSuccessStep({
  paymentSuccess,
  onClose,
}: BookingSuccessStepProps) {
  return (
    <>
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold">Réservation réussie !</h3>
        <p className="text-muted-foreground">
          Votre réservation a été confirmée. Vous recevrez un message de confirmation sous peu.
        </p>
        {paymentSuccess && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Redirection vers vos réservations dans quelques instants...</span>
          </div>
        )}
        {!paymentSuccess && (
          <div className="mt-6">
            <Button onClick={onClose} className="w-full">
              Terminé
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

