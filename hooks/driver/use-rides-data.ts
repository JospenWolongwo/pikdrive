import { useState, useEffect, useCallback, useMemo } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useToast } from "@/hooks/ui";
import { getCurrentTimeUTC } from "@/lib/utils";
import type { RideWithDetails, CancelledBooking } from "@/types";

export function useRidesData() {
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const [ridesData, setRidesData] = useState<{
    rides: RideWithDetails[];
    lastUpdated: number;
  }>({ rides: [], lastUpdated: 0 });
  const [loading, setLoading] = useState(true);
  const [cancelledBookings, setCancelledBookings] = useState<
    CancelledBooking[]
  >([]);

  const nowUTC = useMemo(() => getCurrentTimeUTC(), []);

  // Load cancelled bookings for driver notifications
  const loadCancelledBookings = useCallback(
    async (rideIds: string[]) => {
      try {
        // Get cancelled bookings without complex joins
        const { data: cancelled, error } = await supabase
          .from("bookings")
          .select("id, user_id, seats, updated_at, ride_id")
          .in("ride_id", rideIds)
          .eq("status", "cancelled")
          .gte(
            "updated_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          ) // Last 24 hours
          .order("updated_at", { ascending: false });

        if (error || !cancelled?.length) {
          return;
        }

        // Fetch user profiles separately
        const userIds = [...new Set(cancelled.map((b: any) => b.user_id))];
        const { data: users } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        // Fetch ride details separately
        const { data: rides } = await supabase
          .from("rides")
          .select("id, from_city, to_city")
          .in("id", rideIds);

        const userMap = new Map(users?.map((u: any) => [u.id, u]) || []);
        const rideMap = new Map(rides?.map((r: any) => [r.id, r]) || []);

        const formattedCancelled = cancelled.map((booking: any) => {
          const user = userMap.get(booking.user_id) as any;
          const ride = rideMap.get(booking.ride_id) as any;

          return {
            id: booking.id,
            passengerName: user?.full_name || "Passager inconnu",
            rideRoute: ride
              ? `${ride.from_city} → ${ride.to_city}`
              : "Trajet inconnu",
            seats: booking.seats,
            cancelledAt: booking.updated_at,
          };
        });

        setCancelledBookings(formattedCancelled);
      } catch (error) {
        // Silent error handling
      }
    },
    [supabase]
  );

  const loadRides = useCallback(
    async (forceRefresh = false) => {
      if (!user) return;

      // Check if we have recent data and don't need to refresh
      const now = Date.now();
      const dataAge = now - ridesData.lastUpdated;
      const maxAge = 5 * 60 * 1000; // 5 minutes cache

      if (!forceRefresh && dataAge < maxAge && ridesData.rides.length > 0) {
        return;
      }

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
          setRidesData({ rides: [], lastUpdated: now });
          return;
        }

        // 2. Fetch related data in parallel for all rides
        const rideIds = simpleRides.map((r: any) => r.id);

        // Fetch bookings without complex joins to avoid foreign key issues
        // Exclude cancelled bookings at database level for optimization
        const [{ data: bookings }, { data: messages }] = await Promise.all([
          supabase
            .from("bookings")
            .select(
              "id, ride_id, user_id, seats, status, payment_status, code_verified, created_at, updated_at"
            )
            .or(rideIds.map((id: string) => `ride_id.eq.${id}`).join(","))
            .neq("status", "cancelled")
            .order("created_at", { ascending: false }),
          supabase
            .from("messages")
            .select("id, ride_id, sender_id, content, created_at")
            .or(rideIds.map((id: string) => `ride_id.eq.${id}`).join(","))
            .order("created_at", { ascending: false }),
        ]);

        // Fetch user profiles separately
        const userIds = [
          ...new Set(bookings?.map((b: any) => b.user_id) || []),
        ];
        let userProfiles: {
          [key: string]: { id: string; full_name: string; avatar_url?: string };
        } = {};
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", userIds);

          if (users) {
            userProfiles = Object.fromEntries(users.map((u: any) => [u.id, u]));
          }
        }

        // 3. Combine data with error handling
        const enrichedRides = simpleRides.map((ride: any) => {
          const rideBookings =
            bookings?.filter((b: any) => b.ride_id === ride.id) || [];
          const rideMessages =
            messages?.filter((m: any) => m.ride_id === ride.id) || [];

          return {
            ...ride,
            bookings: rideBookings.map((booking: any) => ({
              ...booking,
              created_at: booking.created_at, // Explicitly preserve created_at for sorting
              user: userProfiles[booking.user_id] || {
                full_name: "Unknown User",
                avatar_url: null,
              },
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
    },
    [user, supabase, toast, loadCancelledBookings]
  );

  // Subscribe to real-time booking changes for immediate notifications
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
        async (payload: any) => {
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

          // Check if payment was completed (status changed to pending_verification)
          if (
            payload.new.status === "pending_verification" &&
            payload.old.status === "pending"
          ) {
            console.log("💳 Payment completed for booking:", payload.new.id);

            // Send push notification to driver about payment completion
            try {
              await fetch("/api/notifications/booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  notificationData: JSON.stringify({
                    type: "payment_completed_driver",
                    userId: user.id,
                    title: "💳 Paiement Recu !",
                    body: "Un passager a complete le paiement. Verifiez le code de reservation.",
                    data: {
                      bookingId: payload.new.id,
                      rideId: payload.new.ride_id,
                      type: "payment_completed_driver",
                    },
                  }),
                }),
              });
            } catch (error) {
              console.warn("⚠️ Failed to send payment notification:", error);
            }
          }

          // Check if booking was confirmed (code verified)
          if (
            payload.new.status === "confirmed" &&
            payload.old.status === "pending_verification"
          ) {
            console.log("✅ Booking confirmed:", payload.new.id);
          }

          // Check if code_verified changed from false to true
          if (
            payload.new.code_verified === true &&
            payload.old.code_verified !== true
          ) {
            console.log("✅ Code verified for booking:", payload.new.id);
            // Refresh rides data immediately to update UI (disable verify button)
            loadRides();
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

  // Function to force refresh data
  const refreshRides = useCallback(() => {
    loadRides(true);
  }, [loadRides]);

  return {
    ridesData,
    loading,
    cancelledBookings,
    loadRides,
    refreshRides,
    nowUTC,
  };
}
