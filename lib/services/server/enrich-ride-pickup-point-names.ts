import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickupPoint } from '@/types';

/** Raw pickup point from DB (may lack name for Phase 1 rides) */
export interface RawPickupPoint {
  id: string;
  name?: string;
  order: number;
  time_offset_minutes: number;
}

/** Ride-shaped object with optional pickup_points array */
export interface RideWithPickupPoints {
  pickup_points?: RawPickupPoint[] | null;
  [key: string]: unknown;
}

/**
 * Enrich ride(s) pickup_points with names from city_pickup_points.
 * If a point already has name (legacy ride), keep it. Otherwise resolve by id.
 */
export async function enrichRidePickupPointNames<T extends RideWithPickupPoints>(
  supabase: SupabaseClient,
  ride: T
): Promise<T>;
export async function enrichRidePickupPointNames<T extends RideWithPickupPoints>(
  supabase: SupabaseClient,
  rides: T[]
): Promise<T[]>;
export async function enrichRidePickupPointNames<T extends RideWithPickupPoints>(
  supabase: SupabaseClient,
  rideOrRides: T | T[]
): Promise<T | T[]> {
  const isArray = Array.isArray(rideOrRides);
  const rides = isArray ? rideOrRides : ([rideOrRides] as T[]);

  const allIdsToResolve = new Set<string>();
  for (const ride of rides) {
    const rawPoints = ride.pickup_points;
    if (!rawPoints || !Array.isArray(rawPoints)) continue;
    for (const p of rawPoints) {
      if (typeof p === 'object' && p !== null && typeof p.id === 'string' && (!p.name || String(p.name).trim() === '')) {
        allIdsToResolve.add(p.id);
      }
    }
  }

  let nameMap = new Map<string, string>();
  if (allIdsToResolve.size > 0) {
    const { data: rows } = await supabase
      .from('city_pickup_points')
      .select('id, name')
      .in('id', Array.from(allIdsToResolve));
    if (rows) {
      rows.forEach((r: { id: string; name: string }) => nameMap.set(r.id, r.name ?? ''));
    }
  }

  const result: T[] = rides.map((ride) => {
    const rawPoints = ride.pickup_points;
    if (!rawPoints || !Array.isArray(rawPoints) || rawPoints.length === 0) {
      return ride;
    }
    const enrichedPoints: PickupPoint[] = rawPoints.map((p) => {
      const name =
        p.name && String(p.name).trim() !== ''
          ? String(p.name).trim()
          : nameMap.get(p.id) ?? '';
      return {
        id: p.id,
        name,
        order: p.order,
        time_offset_minutes: p.time_offset_minutes,
      };
    });
    return { ...ride, pickup_points: enrichedPoints } as T;
  });

  return isArray ? result : result[0];
}
