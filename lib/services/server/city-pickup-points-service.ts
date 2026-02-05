import type { SupabaseClient } from "@supabase/supabase-js";
import type { CityPickupPoint } from "@/types";
import { allCameroonCities } from "@/app/data/cities";

export interface CreateCityPickupPointParams {
  city: string;
  name: string;
  display_order?: number;
}

export interface UpdateCityPickupPointParams {
  name?: string;
  display_order?: number;
}

/**
 * Server-side service for city pickup points (admin CRUD and public list by city).
 */
export class ServerCityPickupPointsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * List pickup points, optionally filtered by city.
   */
  async list(city?: string): Promise<CityPickupPoint[]> {
    let query = this.supabase
      .from("city_pickup_points")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (city != null && city.trim() !== "") {
      query = query.eq("city", city.trim());
    }
    const { data, error } = await query;
    if (error) throw new Error("Failed to fetch pickup points");
    return (data ?? []) as CityPickupPoint[];
  }

  /**
   * Create a pickup point. Validates city is in allowed list.
   */
  async create(params: CreateCityPickupPointParams): Promise<CityPickupPoint> {
    const city = typeof params.city === "string" ? params.city.trim() : "";
    const name = typeof params.name === "string" ? params.name.trim() : "";
    const display_order =
      typeof params.display_order === "number" ? params.display_order : 0;
    if (!city || !name) {
      throw new Error("city and name are required");
    }
    const allowed = new Set<string>(allCameroonCities);
    if (!allowed.has(city)) {
      throw new Error("city must be one of the allowed cities");
    }
    const { data, error } = await this.supabase
      .from("city_pickup_points")
      .insert({ city, name, display_order })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "A pickup point with this name already exists for this city"
        );
      }
      throw new Error("Failed to create pickup point");
    }
    return data as CityPickupPoint;
  }

  /**
   * Update a pickup point by id.
   */
  async update(
    id: string,
    params: UpdateCityPickupPointParams
  ): Promise<CityPickupPoint> {
    const updates: { name?: string; display_order?: number } = {};
    if (typeof params.name === "string" && params.name.trim() !== "") {
      updates.name = params.name.trim();
    }
    if (typeof params.display_order === "number") {
      updates.display_order = params.display_order;
    }
    if (Object.keys(updates).length === 0) {
      throw new Error("No fields to update");
    }
    const { data, error } = await this.supabase
      .from("city_pickup_points")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "A pickup point with this name already exists for this city"
        );
      }
      throw new Error("Failed to update pickup point");
    }
    return data as CityPickupPoint;
  }

  /**
   * Delete a pickup point. Throws if it is used by any ride.
   */
  async delete(id: string): Promise<void> {
    const { data: rides } = await this.supabase
      .from("rides")
      .select("id, pickup_points");
    const usedBy = (rides ?? []).filter((ride: { pickup_points: unknown }) => {
      const pp = ride.pickup_points;
      if (!pp || !Array.isArray(pp)) return false;
      return pp.some((p: { id?: string }) => p.id === id);
    });
    if (usedBy.length > 0) {
      throw new Error(`Cannot delete: used by ${usedBy.length} ride(s)`);
    }
    const { error } = await this.supabase
      .from("city_pickup_points")
      .delete()
      .eq("id", id);
    if (error) throw new Error("Failed to delete pickup point");
  }
}
