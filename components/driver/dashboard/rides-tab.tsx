import { Card, CardContent, Skeleton } from "@/components/ui";
import { RideCard } from "./ride-card";
import { PaginationComponent } from "./pagination";
import type { RideWithDetails } from "@/types";
import { useLocale } from "@/hooks";

const RIDE_CARD_SKELETON_COUNT = 4;

interface RidesTabProps {
  rides: RideWithDetails[];
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  onOpenChat: (
    ride: RideWithDetails,
    user: { id: string; full_name: string; avatar_url?: string }
  ) => void;
  onVerifyCode: (bookingId: string) => void;
  onCheckPayment: (booking: {
    id: string;
    transaction_id?: string;
    payment_provider?: string;
  }) => void;
  onDeleteRide?: (rideId: string) => void;
  isPastRide?: boolean;
  searchQuery: string;
}

export function RidesTab({
  rides,
  currentPage,
  itemsPerPage,
  onPageChange,
  onOpenChat,
  onVerifyCode,
  onCheckPayment,
  onDeleteRide,
  isPastRide = false,
  searchQuery,
  loading = false,
}: RidesTabProps) {
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6" data-testid="rides-tab-skeleton">
        {Array.from({ length: RIDE_CARD_SKELETON_COUNT }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery
              ? t("pages.driver.dashboard.noRides.search", { type: isPastRide ? t("pages.driver.dashboard.noRides.pastType") : t("pages.driver.dashboard.noRides.upcomingType") })
              : isPastRide ? t("pages.driver.dashboard.noRides.past") : t("pages.driver.dashboard.noRides.upcoming")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const paginatedRides = rides.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {paginatedRides.map((ride: RideWithDetails) => (
        <RideCard
          key={ride.id}
          ride={ride}
          onOpenChat={onOpenChat}
          onVerifyCode={onVerifyCode}
          onCheckPayment={onCheckPayment}
          onDeleteRide={onDeleteRide}
          isPastRide={isPastRide}
        />
      ))}

      <PaginationComponent
        currentPage={currentPage}
        totalItems={rides.length}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
      />
    </div>
  );
}
