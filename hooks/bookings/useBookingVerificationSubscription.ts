"use client";

import { useEffect } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";

/**
 * Subscribes to real-time updates for a booking's code_verified field.
 * Calls onVerified when code_verified flips from non-true to true.
 */
export function useBookingVerificationSubscription(
  bookingId: string,
  onVerified: () => void
): void {
  const { supabase } = useSupabase();

  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel(`booking-verification-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `id=eq.${bookingId}`,
        },
        (payload: { new?: { code_verified?: boolean }; old?: { code_verified?: boolean } }) => {
          if (
            payload.new?.code_verified === true &&
            payload.old?.code_verified !== true
          ) {
            onVerified();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, supabase, onVerified]);
}
