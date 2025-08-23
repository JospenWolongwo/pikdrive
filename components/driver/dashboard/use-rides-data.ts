import { useState, useEffect, useCallback, useMemo } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useToast } from "@/components/ui/use-toast";
import type { Ride, CancelledBooking } from "./types";

export function useRidesData() {
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const [ridesData, setRidesData] = useState<{
    rides: Ride[];
    lastUpdated: number;
  }>({ rides: [], lastUpdated: 0 });
  const [loading, setLoading] = useState(true);
  const [cancelledBookings, setCancelledBookings] = useState<
    CancelledBooking[]
  >([]);

  // Get current time in UTC - wrapped in useMemo to prevent dependency changes on every render
  const nowUTC = useMemo(() => {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      )
    );
  }, []); // Empty dependency array means this only runs once

  // Load cancelled bookings for driver notifications
  const loadCancelledBookings = useCallback(
    async (rideIds: string[]) => {
      try {
        const { data: cancelled, error } = await supabase
          .from("bookings")
          .select(
            `
            id,
            seats,
            created_at,
            updated_at,
            user:profiles(full_name),
            ride:rides(from_city, to_city)
          `
          )
          .in("ride_id", rideIds)
          .eq("status", "cancelled")
          .gte(
            "updated_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          ) // Last 24 hours
          .order("updated_at", { ascending: false });

        if (error) {
          return;
        }

        const formattedCancelled =
          cancelled?.map((booking: any) => ({
            id: booking.id,
            passengerName: booking.user?.full_name || "Passager inconnu",
            rideRoute: `${booking.ride?.from_city} → ${booking.ride?.to_city}`,
            seats: booking.seats,
            cancelledAt: booking.updated_at,
          })) || [];

        setCancelledBookings(formattedCancelled);
      } catch (error) {
        // Silent error handling
      }
    },
    [supabase]
  );

  const loadRides = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get all rides without pagination to properly filter upcoming/past
      const { data: simpleRides, error: simpleError } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .order("departure_time", { ascending: true });

      if (simpleError) throw simpleError;
      if (!simpleRides?.length) {
        setRidesData({ rides: [], lastUpdated: Date.now() });
        return;
      }

      // 2. Fetch related data in parallel for all rides
      const rideIds = simpleRides.map((r: Ride) => r.id);

      const [{ data: bookings }, { data: messages }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, user:profiles(id, full_name, avatar_url)")
          .in("ride_id", rideIds),
        supabase
          .from("messages")
          .select("*, sender:profiles(id, full_name, avatar_url)")
          .in("ride_id", rideIds),
      ]);

      // 3. Combine data with error handling
      const enrichedRides = simpleRides.map((ride: Ride) => {
        const rideBookings =
          bookings?.filter((b: any) => b.ride_id === ride.id) || [];
        const rideMessages =
          messages?.filter((m: any) => m.ride_id === ride.id) || [];

        return {
          ...ride,
          bookings: rideBookings.map((booking: any) => ({
            ...booking,
            user: booking.user,
          })),
          messages: rideMessages.map((message: any) => ({
            ...message,
            sender: message.sender,
          })),
        };
      });

      setRidesData({ rides: enrichedRides, lastUpdated: Date.now() });

      // Load cancelled bookings for notifications
      await loadCancelledBookings(rideIds);
    } catch (error) {
      toast({
        title: "Erreur",
        description:
          "Erreur lors du chargement des trajets. Veuillez réessayer plus tard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast, loadCancelledBookings]);

  // Subscribe to real-time booking changes for immediate cancellation notifications
  useEffect(() => {
    if (!user || !ridesData.rides.length) return;

    const rideIds = ridesData.rides.map((ride) => ride.id);

    const channel = supabase
      .channel("driver-bookings-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `ride_id=in.(${rideIds.join(",")})`,
        },
        (payload: any) => {
          // Check if this is a cancellation
          if (
            payload.new.status === "cancelled" &&
            payload.old.status !== "cancelled"
          ) {
            // Add to cancelled bookings immediately for instant notification
            const cancelledBooking = {
              id: payload.new.id,
              passengerName: "Passager", // Will be updated when data refreshes
              rideRoute: "Trajet", // Will be updated when data refreshes
              seats: payload.new.seats,
              cancelledAt: payload.new.updated_at,
            };

            setCancelledBookings((prev) => [cancelledBooking, ...prev]);

            // Refresh data to get full details
            setTimeout(() => {
              loadRides();
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, ridesData.rides, supabase, loadRides]);

  // Load rides on mount and when user changes
  useEffect(() => {
    if (user) {
      loadRides();
    }
  }, [user, loadRides]);

  return {
    ridesData,
    loading,
    cancelledBookings,
    loadRides,
    nowUTC,
  };
}
