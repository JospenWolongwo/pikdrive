import type { SupabaseClient } from "@supabase/supabase-js";
import type { RideWithMessages, RideMessage } from "@/types/chat";

type Result<T> = { success: true; data: T } | { success: false; error: Error };

/** Fetch a ride with messages and bookings (driver must own the ride). */
export async function fetchRideWithMessages(
  supabase: SupabaseClient,
  rideId: string,
  driverId: string
): Promise<Result<RideWithMessages>> {
  try {
    const { data, error } = await supabase
      .from("rides")
      .select(
        `
        id,
        from_city,
        to_city,
        departure_time,
        driver_id,
        messages (
          id,
          content,
          created_at,
          sender:profiles (
            id,
            full_name
          )
        ),
        bookings (
          id,
          passenger:profiles (
            id,
            full_name,
            avatar_url
          )
        )
      `
      )
      .eq("id", rideId)
      .eq("driver_id", driverId)
      .single();

    if (error) {
      return { success: false, error: new Error(error.message) };
    }
    if (!data) {
      return { success: false, error: new Error("Ride not found") };
    }

    const ride = data as unknown as RideWithMessages;
    return { success: true, data: ride };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error("Failed to load ride"),
    };
  }
}

/** Subscribe to new messages for a ride. Returns unsubscribe function. */
export function subscribeToRideMessages(
  supabase: SupabaseClient,
  rideId: string,
  onNewMessage: (message: RideMessage) => void
): () => void {
  const channel = supabase
    .channel(`ride:${rideId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `ride_id=eq.${rideId}`,
      },
      async (payload: { new: { id: string; content: string; created_at: string; sender_id: string } }) => {
        const row = payload.new;
        const { data: senderData, error: senderError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.sender_id)
          .single();

        if (senderError) return;

        const message: RideMessage = {
          id: row.id,
          ride_id: rideId,
          content: row.content,
          created_at: row.created_at,
          sender: {
            id: row.sender_id,
            full_name: (senderData?.full_name as string) ?? "Unknown",
          },
        };
        onNewMessage(message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Send a message for a ride. */
export async function sendRideMessage(
  supabase: SupabaseClient,
  params: {
    rideId: string;
    senderId: string;
    receiverId: string;
    content: string;
  }
): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("messages").insert({
      ride_id: params.rideId,
      sender_id: params.senderId,
      receiver_id: params.receiverId,
      content: params.content.trim(),
    });

    if (error) {
      return { success: false, error: new Error(error.message) };
    }
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error("Failed to send message"),
    };
  }
}

/** Resolve receiver id for the current user (driver → passenger, passenger → driver). */
export function getReceiverIdForRide(
  ride: RideWithMessages,
  currentUserId: string
): string | null {
  if (currentUserId === ride.driver_id) {
    const passenger = ride.bookings?.[0]?.passenger;
    return passenger?.id ?? null;
  }
  return ride.driver_id;
}
