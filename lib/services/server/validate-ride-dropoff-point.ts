import type { SupabaseClient } from "@supabase/supabase-js";

export interface StoredDropoffPoint {
  id: string;
  name: string;
}

/**
 * Validate destination dropoff point: id must exist in city_pickup_points and match to_city.
 */
export async function validateAndResolveDropoffPoint(
  supabase: SupabaseClient,
  toCity: string,
  dropoffPointId: string | undefined
): Promise<StoredDropoffPoint> {
  if (!dropoffPointId || dropoffPointId.trim() === "") {
    throw new Error("Dropoff point is required");
  }

  const { data, error } = await supabase
    .from("city_pickup_points")
    .select("id, city, name")
    .eq("id", dropoffPointId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to validate dropoff point");
  }

  if (!data) {
    throw new Error("Invalid dropoff point");
  }

  if (data.city !== toCity) {
    throw new Error("Dropoff point must belong to the ride destination city");
  }

  return {
    id: data.id,
    name: data.name,
  };
}
