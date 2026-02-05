/**
 * Seed data for city_pickup_points (precise public places per city).
 * Used by scripts/seed-pickup-points.js. Editable via admin dashboard after seeding.
 */
import seedData from "./pickup-points-seed.json";

export interface PickupPointSeedEntry {
  readonly city: string;
  readonly name: string;
  readonly display_order: number;
}

export const pickupPointsSeed: PickupPointSeedEntry[] = seedData as PickupPointSeedEntry[];
