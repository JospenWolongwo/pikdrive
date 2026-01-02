import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileData } from "@/types/user";

type Result<T> = { success: true; data: T } | { success: false; error: Error };

interface CreateProfileParams {
  readonly id: string;
  readonly phone: string | null;
  readonly email: string | null;
}

interface UpdateProfileParams {
  readonly full_name?: string;
  readonly email?: string;
  readonly city?: string;
  readonly avatar_url?: string;
  readonly updated_at: string;
}

export class ProfileService {
  constructor(private supabase: SupabaseClient) {}

  async loadProfile(userId: string): Promise<Result<ProfileData>> {
    try {
      const { data: profile, error: profileError } = await this.supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        return {
          success: false,
          error: new Error(profileError.message || "Failed to load profile"),
        };
      }

      if (!profile) {
        return {
          success: false,
          error: new Error("Profile not found"),
        };
      }

      return { success: true, data: profile as ProfileData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      };
    }
  }

  async createProfile(
    userId: string,
    params: CreateProfileParams
  ): Promise<Result<ProfileData>> {
    try {
      const { error: createError } = await this.supabase
        .from("profiles")
        .insert({
          id: userId,
          phone: params.phone,
          email: params.email,
          full_name: null,
          city: null,
          avatar_url: null,
          is_driver: false,
          driver_status: "pending",
          role: "user",
          driver_application_status: "pending",
          driver_application_date: null,
          is_driver_applicant: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (createError) {
        // If profile already exists, fetch it
        if (
          createError.code === "23505" ||
          createError.message?.includes("duplicate")
        ) {
          const result = await this.loadProfile(userId);
          return result;
        }

        return {
          success: false,
          error: new Error(createError.message || "Failed to create profile"),
        };
      }

      // Retry loading after creation
      const result = await this.loadProfile(userId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      };
    }
  }

  async updateProfile(
    userId: string,
    params: UpdateProfileParams
  ): Promise<Result<ProfileData>> {
    try {
      const { error: updateError } = await this.supabase
        .from("profiles")
        .update(params)
        .eq("id", userId);

      if (updateError) {
        return {
          success: false,
          error: new Error(updateError.message || "Failed to update profile"),
        };
      }

      const result = await this.loadProfile(userId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      };
    }
  }


}

