import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { Car, Shield } from "lucide-react";
import { useLocale } from "@/hooks";
import { withCacheBuster } from "@/lib/utils/cache-buster";

interface VehicleGalleryProps {
  vehicle_images: string[];
  isVerified: boolean;
}

export function VehicleGallery({
  vehicle_images,
  isVerified,
}: VehicleGalleryProps) {
  const { t } = useLocale();
  
  if (!vehicle_images || vehicle_images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            {t("pages.driverProfile.vehicleGallery.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-center">
            <div>
              <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {t("pages.driverProfile.vehicleGallery.notAvailable")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          {t("pages.driverProfile.vehicleGallery.title")}
        </CardTitle>
        {isVerified && (
          <Badge variant="outline" className="gap-2">
            <Shield className="h-3 w-3" />
            {t("pages.driverProfile.vehicleGallery.verified")}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicle_images.map((imageUrl, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-lg overflow-hidden bg-muted"
            >
              <img
                src={withCacheBuster(imageUrl)}
                alt={`${t("pages.becomeDriver.vehicleImages.vehiclePhoto")} ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

