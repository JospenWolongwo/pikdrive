"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DriverProfileHeader,
  DriverRecentRides,
  DriverStatistics,
  TrustBadges,
  VehicleGallery,
} from "@/components";
import { RatingSummary, ReviewList } from "@/components/reviews";
import { Button } from "@/components/ui";
import { ArrowLeft, AlertCircle, MapPin } from "lucide-react";
import Link from "next/link";
import { driverApiClient } from "@/lib/api-client/driver";
import { ApiError } from "@/lib/api-client/error";
import { useLocale } from "@/hooks";
import type { DriverPublicProfile } from "@/types/driver";
import type { ReviewWithProfiles, ReviewStatistics } from "@/types/review";

export default function DriverProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocale();
  const driverId = params.id as string;
  const [profile, setProfile] = useState<DriverPublicProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewWithProfiles[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDriverProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await driverApiClient.getDriverProfile(driverId);

        if (!response.success || !response.data) {
          setError(response.error || "Driver not found");
          return;
        }

        setProfile(response.data);
      } catch (err) {
        console.error("Error fetching driver profile:", err);
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

  // Fetch reviews and statistics
  useEffect(() => {
    const fetchReviews = async () => {
      if (!driverId) return;

      try {
        setReviewsLoading(true);

        // Fetch reviews
        const reviewsResponse = await fetch(`/api/reviews?reviewee_id=${driverId}&limit=10`);
        const reviewsData = await reviewsResponse.json();

        if (reviewsData.success && reviewsData.data) {
          setReviews(reviewsData.data);
        }

        // Fetch statistics
        const statsResponse = await fetch(`/api/reviews/user/${driverId}?include_stats=true`);
        const statsData = await statsResponse.json();

        if (statsData.success && statsData.data?.statistics) {
          setReviewStats(statsData.data.statistics);
        }
      } catch (err) {
        console.error("Error fetching reviews:", err);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [driverId]);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">{t("pages.driverProfile.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col justify-center items-center min-h-[400px] text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">{t("pages.driverProfile.notFound.title")}</h2>
          <p className="text-muted-foreground mb-6">
            {error || t("pages.driverProfile.notFound.description")}
          </p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("pages.driverProfile.actions.back")}
            </Button>
            <Link href="/rides">
              <Button>{t("pages.driverProfile.actions.viewRides")}</Button>
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
          {t("pages.driverProfile.actions.back")}
        </Button>
      </div>

      {/* Header Section */}
      <DriverProfileHeader
        full_name={profile.full_name}
        avatar_url={profile.avatar_url}
        city={profile.city}
        memberSince={profile.statistics.memberSince}
        isVerified={isVerified}
        average_rating={profile.average_rating}
        total_reviews={profile.total_reviews}
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

      {/* Reviews Section */}
      {profile.total_reviews && profile.total_reviews > 0 && (
        <div className="my-8">
          <h2 className="text-2xl font-bold mb-6">{t("pages.driverProfile.reviews.title")}</h2>
          
          {/* Rating Summary */}
          {reviewStats && !reviewsLoading && (
            <div className="mb-6">
              <RatingSummary statistics={reviewStats} />
            </div>
          )}

          {/* Reviews List */}
          {!reviewsLoading && reviews.length > 0 && (
            <ReviewList reviews={reviews} showFilters={false} />
          )}

          {reviewsLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          )}
        </div>
      )}

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
            {t("pages.driverProfile.actions.viewDriverRides")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

