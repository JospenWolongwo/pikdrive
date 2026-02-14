import { useState, useEffect } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useToast, useLocale } from "@/hooks";
import { DriverDocumentsService, ProfileStorageService } from "@/lib/services/client/profile";
import type { DriverDocuments } from "@/types/user";

interface UseVehicleImagesReturn {
  readonly vehicleImages: string[];
  readonly newVehicleImages: File[];
  readonly newVehicleImageUrls: string[];
  readonly isEditing: boolean;
  readonly setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  readonly handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly handleSave: () => Promise<void>;
  readonly handleRemove: (imageUrl: string) => Promise<void>;
  readonly handleRemovePreview: (index: number) => void;
  readonly handleCancel: () => void;
  readonly isLoading: boolean;
}

export function useVehicleImages(
  driverId: string | undefined,
  driverDocuments: DriverDocuments | null,
  onDocumentsUpdated?: (documents: DriverDocuments) => void
): UseVehicleImagesReturn {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const { t } = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newVehicleImages, setNewVehicleImages] = useState<File[]>([]);
  const [newVehicleImageUrls, setNewVehicleImageUrls] = useState<string[]>([]);

  const driverDocumentsService = new DriverDocumentsService(supabase);
  const storageService = new ProfileStorageService(supabase);

  const vehicleImages = driverDocuments?.vehicle_images || [];

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      newVehicleImageUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [newVehicleImageUrls]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;

    const files = Array.from(e.target.files);

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: t("pages.profile.error"),
          description: t("pages.profile.vehicleImages.fileSizeError"),
        });
        return;
      }
    }

    const newUrls: string[] = [];
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      newUrls.push(url);
    });

    setNewVehicleImages((prev) => [...prev, ...files]);
    setNewVehicleImageUrls((prev) => [...prev, ...newUrls]);

    e.target.value = "";
  };

  const handleSave = async () => {
    if (newVehicleImages.length === 0 || !driverId) {
      setIsEditing(false);
      return;
    }

    try {
      setIsLoading(true);

      const uploadedUrls: string[] = [];

      for (const file of newVehicleImages) {
        const result = await storageService.uploadVehicleImage(driverId, file);

        if (!result.success) {
          throw result.error;
        }

        uploadedUrls.push(result.data.publicUrl);
      }

      // Update driver documents with new vehicle images
      const currentImages = driverDocuments?.vehicle_images || [];
      const updatedVehicleImages = [...currentImages, ...uploadedUrls];

      const result = await driverDocumentsService.updateDriverDocuments(
        driverId,
        {
          vehicle_images: updatedVehicleImages,
          updated_at: new Date().toISOString(),
        }
      );

      if (!result.success) {
        throw result.error;
      }

      if (onDocumentsUpdated) {
        onDocumentsUpdated(result.data);
      }

      setNewVehicleImages([]);
      setNewVehicleImageUrls([]);
      setIsEditing(false);

      toast({
        title: t("pages.profile.toast.success"),
        description: `${newVehicleImages.length} ${t("pages.profile.vehicleImages.uploadSuccess")}`,
      });
    } catch (error: any) {
      console.error("Error uploading vehicle images:", error);
      toast({
        variant: "destructive",
        title: t("pages.profile.error"),
        description: error.message || t("pages.profile.vehicleImages.uploadError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (imageUrl: string) => {
    if (!driverId) return;

    try {
      setIsLoading(true);

      const result = await driverDocumentsService.removeVehicleImage(
        driverId,
        imageUrl
      );

      if (!result.success) {
        throw result.error;
      }

      if (onDocumentsUpdated) {
        onDocumentsUpdated(result.data);
      }

      toast({
        title: t("pages.profile.toast.success"),
        description: t("pages.profile.vehicleImages.removeSuccess"),
      });
    } catch (error: any) {
      console.error("Error removing vehicle image:", error);
      toast({
        variant: "destructive",
        title: t("pages.profile.error"),
        description: error.message || t("pages.profile.vehicleImages.removeError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePreview = (index: number) => {
    setNewVehicleImages((prev) => prev.filter((_, i) => i !== index));
    setNewVehicleImageUrls((prev) => {
      const url = prev[index];
      if (url) {
        URL.revokeObjectURL(url);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCancel = () => {
    setNewVehicleImages([]);
    setNewVehicleImageUrls([]);
    setIsEditing(false);
  };

  return {
    vehicleImages,
    newVehicleImages,
    newVehicleImageUrls,
    isEditing,
    setIsEditing,
    handleUpload,
    handleSave,
    handleRemove,
    handleRemovePreview,
    handleCancel,
    isLoading,
  };
}

