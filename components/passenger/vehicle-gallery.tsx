import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Shield } from "lucide-react";

interface VehicleGalleryProps {
  vehicle_images: string[];
  isVerified: boolean;
}

export function VehicleGallery({
  vehicle_images,
  isVerified,
}: VehicleGalleryProps) {
  console.log('🚗 [VEHICLE GALLERY] Rendering with:', {
    vehicle_images_count: vehicle_images?.length || 0,
    vehicle_images: vehicle_images,
    isVerified,
  });

  if (!vehicle_images || vehicle_images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Véhicule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-center">
            <div>
              <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Photos du véhicule non disponibles
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
          Véhicule
        </CardTitle>
        {isVerified && (
          <Badge variant="outline" className="gap-2">
            <Shield className="h-3 w-3" />
            Véhicule vérifié
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicle_images.map((imageUrl, index) => {
            console.log(`🖼️ [VEHICLE GALLERY] Rendering image ${index + 1}:`, imageUrl);
            return (
              <div
                key={index}
                className="relative aspect-video rounded-lg overflow-hidden bg-muted"
              >
                <img
                  src={imageUrl}
                  alt={`Photo du véhicule ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    console.error(`❌ [VEHICLE GALLERY] Image ${index + 1} failed to load:`, imageUrl);
                    target.style.display = "none";
                  }}
                  onLoad={() => {
                    console.log(`✅ [VEHICLE GALLERY] Image ${index + 1} loaded successfully:`, imageUrl);
                  }}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

