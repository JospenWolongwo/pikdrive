import type { SupabaseClient } from "@supabase/supabase-js";

type Result<T> = { success: true; data: T } | { success: false; error: Error };

export class ProfileStorageService {
  constructor(private supabase: SupabaseClient) {}

  getAvatarUrl(avatarUrl: string | null): string | null {
    if (!avatarUrl) return null;
    const {
      data: { publicUrl },
    } = this.supabase.storage.from("avatars").getPublicUrl(avatarUrl);
    return publicUrl;
  }

  async uploadAvatar(
    userId: string,
    file: File
  ): Promise<Result<{ fileName: string; publicUrl: string }>> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await this.supabase.storage
        .from("avatars")
        .upload(fileName, file);

      if (uploadError) {
        return {
          success: false,
          error: new Error(uploadError.message || "Failed to upload avatar"),
        };
      }

      const {
        data: { publicUrl },
      } = this.supabase.storage.from("avatars").getPublicUrl(fileName);

      return {
        success: true,
        data: { fileName, publicUrl },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      };
    }
  }

  async uploadVehicleImage(
    driverId: string,
    file: File
  ): Promise<Result<{ fileName: string; publicUrl: string }>> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `vehicle-${driverId}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;

      const { error: uploadError } = await this.supabase.storage
        .from("driver_documents")
        .upload(fileName, file);

      if (uploadError) {
        return {
          success: false,
          error: new Error(
            uploadError.message || "Failed to upload vehicle image"
          ),
        };
      }

      const {
        data: { publicUrl },
      } = this.supabase.storage
        .from("driver_documents")
        .getPublicUrl(fileName);

      return {
        success: true,
        data: { fileName, publicUrl },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      };
    }
  }
}

