import type { SupabaseClient } from '@supabase/supabase-js';
import type { RidePickupPointInput } from '@/types';

export interface StoredPickupPoint {
  id: string;
  order: number;
  time_offset_minutes: number;
}

/**
 * Validate pickup points: ids must exist in city_pickup_points and match from_city.
 * Returns array of { id, order, time_offset_minutes } for storage.
 */
export async function validateAndProcessPickupPoints(
  supabase: SupabaseClient,
  fromCity: string,
  pickupPoints: readonly RidePickupPointInput[] | undefined
): Promise<StoredPickupPoint[] | null> {
  if (!pickupPoints || pickupPoints.length === 0) {
    return null;
  }
  if (pickupPoints.length < 1) {
    throw new Error('At least 1 pickup point is required');
  }

  const ids = [...new Set(pickupPoints.map((p) => p.id))];
  const { data: rows, error } = await supabase
    .from('city_pickup_points')
    .select('id, city')
    .in('id', ids);

  if (error) {
    throw new Error('Failed to validate pickup points');
  }

  const byId = new Map<string, { city: string }>();
  (rows || []).forEach((r: { id: string; city: string }) => byId.set(r.id, { city: r.city }));

  const sorted = [...pickupPoints]
    .map((p, index) => ({
      id: p.id,
      order: typeof p.order === 'number' ? p.order : index + 1,
      time_offset_minutes: typeof p.time_offset_minutes === 'number' ? p.time_offset_minutes : 0,
    }))
    .sort((a, b) => a.order - b.order);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (p.time_offset_minutes < 0) {
      throw new Error(`Pickup point ${i + 1}: time_offset_minutes must be non-negative`);
    }
    const row = byId.get(p.id);
    if (!row) {
      throw new Error(`Pickup point ${i + 1}: invalid or unknown pickup point id`);
    }
    if (row.city !== fromCity) {
      throw new Error(`Pickup point ${i + 1}: must belong to the ride's from city`);
    }
  }

  return sorted.map(({ id, order, time_offset_minutes }) => ({ id, order, time_offset_minutes }));
}
