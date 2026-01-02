import type { SupabaseClient } from "@supabase/supabase-js";
import type { DriverDocuments } from "@/types/user";

type Result<T> = { success: true; data: T } | { success: false; error: Error };

interface UpdateDriverDocumentsParams {
  readonly vehicle_images?: string[];
  readonly updated_at: string;
}

export class DriverDocumentsService {
  constructor(private supabase: SupabaseClient) {}

  async loadDriverDocuments(
    driverId: string
  ): Promise<Result<DriverDocuments | null>> {
    try {
      const { data: documents, error: docError } = await this.supabase
        .from("driver_documents")
        .select("*")
        .eq("driver_id", driverId)
        .maybeSingle();

      if (docError) {
        return {
          success: false,
          error: new Error(
            docError.message || "Failed to load driver documents"
          ),
        };
      }

      return {
        success: true,
        data: documents as DriverDocuments | null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      };
    }
  }

  async updateDriverDocuments(
    driverId: string,
    params: UpdateDriverDocumentsParams
  ): Promise<Result<DriverDocuments>> {
    try {
      // Check if driver document exists
      const { data: existingDoc, error: checkError } = await this.supabase
        .from("driver_documents")
        .select("driver_id")
        .eq("driver_id", driverId)
        .maybeSingle();

      if (checkError) {
        return {
          success: false,
          error: new Error(
            checkError.message || "Failed to check driver document"
          ),
        };
      }

      let result: Result<DriverDocuments>;

      if (existingDoc) {
        // Update existing record
        const { data, error: updateError } = await this.supabase
          .from("driver_documents")
          .update(params)
          .eq("driver_id", driverId)
          .select()
          .single();

        if (updateError) {
          return {
            success: false,
            error: new Error(
              updateError.message || "Failed to update driver documents"
            ),
          };
        }

        result = {
          success: true,
          data: data as DriverDocuments,
        };
      } else {
        // Insert new record
        const { data, error: insertError } = await this.supabase
          .from("driver_documents")
          .insert({
            driver_id: driverId,
            vehicle_images: params.vehicle_images || [],
            status: "pending",
            national_id_number: "",
            license_number: "",
            registration_number: "",
            insurance_number: "",
            technical_inspection_number: "",
            road_tax_number: "",
            created_at: new Date().toISOString(),
            updated_at: params.updated_at,
            national_id_file_recto: null,
            national_id_file_verso: null,
            license_file_recto: null,
            license_file_verso: null,
            registration_file_recto: null,
            registration_file_verso: null,
            insurance_file_recto: null,
            insurance_file_verso: null,
          })
          .select()
          .single();

        if (insertError) {
          return {
            success: false,
            error: new Error(
              insertError.message || "Failed to create driver documents"
            ),
          };
        }

        result = {
          success: true,
          data: data as DriverDocuments,
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      };
    }
  }

  async removeVehicleImage(
    driverId: string,
    imageUrl: string
  ): Promise<Result<DriverDocuments>> {
    try {
      const documentsResult = await this.loadDriverDocuments(driverId);

      if (!documentsResult.success) {
        return documentsResult;
      }

      const currentDocuments = documentsResult.data;
      const currentImages = currentDocuments?.vehicle_images || [];
      const newImages = currentImages.filter((img) => img !== imageUrl);

      const updateResult = await this.updateDriverDocuments(driverId, {
        vehicle_images: newImages,
        updated_at: new Date().toISOString(),
      });

      return updateResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      };
    }
  }
}

