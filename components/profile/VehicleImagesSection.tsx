import { useLocale } from "@/hooks";
import { useVehicleImages } from "@/hooks/profile";
import { Button, Label } from "@/components/ui";
import {
  Camera,
  Edit3,
  X,
  Save,
  Loader2,
} from "lucide-react";
import type { DriverDocuments } from "@/types/user";

interface VehicleImagesSectionProps {
  readonly driverId: string | undefined;
  readonly driverDocuments: DriverDocuments | null;
  readonly onDocumentsUpdated?: (documents: DriverDocuments) => void;
}

export function VehicleImagesSection({
  driverId,
  driverDocuments,
  onDocumentsUpdated,
}: VehicleImagesSectionProps) {
  const { t } = useLocale();
  const {
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
  } = useVehicleImages(driverId, driverDocuments, onDocumentsUpdated);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          {t("pages.profile.vehicleImages.title")}
        </h4>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          {isEditing ? (
            <X className="w-4 h-4" />
          ) : (
            <Edit3 className="w-4 h-4" />
          )}
          {isEditing
            ? t("pages.profile.vehicleImages.cancel")
            : t("pages.profile.vehicleImages.edit")}
        </Button>
      </div>

      {/* Upload interface */}
      {isEditing && (
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("pages.profile.vehicleImages.addPhotos")}
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleUpload}
                disabled={isLoading}
                className="hidden"
                id="vehicle-images-upload"
              />
              <label
                htmlFor="vehicle-images-upload"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {t("pages.profile.vehicleImages.addPhotos")}
              </label>
              <span className="text-xs text-muted-foreground">
                {t("pages.profile.vehicleImages.fileFormats")}
              </span>
            </div>
          </div>

          {/* Preview of new images */}
          {newVehicleImageUrls.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("pages.profile.vehicleImages.newPhotosToAdd")}
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {newVehicleImageUrls.map((url, index) => (
                  <div
                    key={index}
                    className="relative aspect-square bg-muted rounded-lg overflow-hidden border"
                  >
                    <img
                      src={url}
                      alt={`${t("pages.profile.vehicleImages.newPhoto")} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemovePreview(index)}
                      className="absolute top-1 right-1 w-6 h-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={isLoading || newVehicleImages.length === 0}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLoading
                ? t("pages.profile.vehicleImages.saving")
                : t("pages.profile.vehicleImages.save")}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {t("pages.profile.vehicleImages.cancel")}
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("pages.profile.vehicleImages.savingPhotos")}
            </div>
          )}
        </div>
      )}

      {/* Show existing images or empty state */}
      {vehicleImages && vehicleImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {vehicleImages.map((image, index) => (
            <div
              key={index}
              className="relative group aspect-square bg-muted rounded-lg overflow-hidden border"
            >
              <img
                src={image}
                alt={`${t("pages.profile.vehicleImages.title")} ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />

              {isEditing && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(image)}
                    disabled={isLoading}
                    className="flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    {t("pages.profile.vehicleImages.remove")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {t("pages.profile.vehicleImages.noPhotos")}
          </p>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="mt-2"
            >
              <Camera className="w-4 h-4 mr-2" />
              {t("pages.profile.vehicleImages.addPhotos")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

