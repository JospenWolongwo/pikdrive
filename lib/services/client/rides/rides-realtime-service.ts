import type { SupabaseClient } from "@supabase/supabase-js";

const RIDES_NEW_CHANNEL = "rides-page-new-rides";

/**
 * Subscribes to new ride INSERTs on the rides table (realtime).
 * Use when the passenger list should refetch when a driver publishes a new ride.
 *
 * @param supabase - Supabase client
 * @param onNewRide - Callback when a new ride is inserted (e.g. trigger refetch)
 * @returns Unsubscribe function
 */
export function subscribeToNewRides(
  supabase: SupabaseClient,
  onNewRide: () => void
): () => void {
  const channel = supabase
    .channel(RIDES_NEW_CHANNEL)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "rides",
      },
      onNewRide
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
