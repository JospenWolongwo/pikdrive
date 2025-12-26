"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DriverProfileHeader } from "@/components/passenger/driver-profile-header";
import { DriverStatistics } from "@/components/passenger/driver-statistics";
import { VehicleGallery } from "@/components/passenger/vehicle-gallery";
import { TrustBadges } from "@/components/passenger/trust-badges";
import { DriverRecentRides } from "@/components/passenger/driver-recent-rides";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, MapPin } from "lucide-react";
import Link from "next/link";
import { driverApiClient } from "@/lib/api-client/driver";
import { ApiError } from "@/lib/api-client/error";
import type { DriverPublicProfile } from "@/types/driver";

export default function DriverProfilePage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.id as string;
  const [profile, setProfile] = useState<DriverPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDriverProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 [DRIVER PROFILE PAGE] Fetching profile for driverId:', driverId);
        
        const response = await driverApiClient.getDriverProfile(driverId);

        console.log('📥 [DRIVER PROFILE PAGE] API Response received:', {
          success: response.success,
          has_data: !!response.data,
          error: response.error,
          profile_keys: response.data ? Object.keys(response.data) : [],
        });

        if (!response.success || !response.data) {
          console.error('❌ [DRIVER PROFILE PAGE] Response error:', response.error);
          setError(response.error || "Driver not found");
          return;
        }

        console.log('✅ [DRIVER PROFILE PAGE] Setting profile data:', {
          id: response.data.id,
          full_name: response.data.full_name,
          avatar_url: response.data.avatar_url,
          vehicle_images_count: response.data.vehicle_images?.length || 0,
          vehicle_images: response.data.vehicle_images,
          statistics: response.data.statistics,
        });

        setProfile(response.data);
      } catch (err) {
        console.error("❌ [DRIVER PROFILE PAGE] Error fetching driver profile:", err);
        if (err instanceof ApiError) {
          setError(err.message || "Failed to load driver profile");
        } else {
          setError("Failed to load driver profile");
        }
      } finally {
        setLoading(false);
      }
    };

    if (driverId) {
      fetchDriverProfile();
    }
  }, [driverId]);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col justify-center items-center min-h-[400px] text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Profil non trouvé</h2>
          <p className="text-muted-foreground mb-6">
            {error || "Ce conducteur n'existe pas ou n'est pas disponible."}
          </p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Link href="/rides">
              <Button>Voir les trajets disponibles</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isVerified =
    profile.verification_status === "approved" &&
    profile.driver_status === "approved";

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </div>

      {/* Header Section */}
      <DriverProfileHeader
        full_name={profile.full_name}
        avatar_url={profile.avatar_url}
        city={profile.city}
        memberSince={profile.statistics.memberSince}
        isVerified={isVerified}
      />

      {/* Statistics Section */}
      <div className="my-8">
        <DriverStatistics
          totalTrips={profile.statistics.totalTrips}
          totalPassengers={profile.statistics.totalPassengers}
          memberSince={profile.statistics.memberSince}
        />
      </div>

      {/* Trust Badges Section */}
      <div className="my-8">
        <TrustBadges
          verificationStatus={profile.verification_status}
          driverStatus={profile.driver_status}
        />
      </div>

      {/* Vehicle Gallery Section */}
      <div className="my-8">
        <VehicleGallery
          vehicle_images={profile.vehicle_images}
          isVerified={isVerified}
        />
      </div>

      {/* Recent Rides Section */}
      {profile.recentRides && profile.recentRides.length > 0 && (
        <div className="my-8">
          <DriverRecentRides rides={profile.recentRides} driverId={profile.id} />
        </div>
      )}

      {/* Call to Action */}
      <div className="my-8 flex justify-center">
        <Link href={`/rides?driver_id=${profile.id}`}>
          <Button size="lg" className="gap-2">
            <MapPin className="h-5 w-5" />
            Voir les trajets de ce conducteur
          </Button>
        </Link>
      </div>
    </div>
  );
}

