import { Card, CardContent } from "@/components/ui/card";
import { RideCard } from "./ride-card";
import { PaginationComponent } from "./pagination";
import type { RideWithDetails } from "@/types";
import { useLocale } from "@/hooks";

interface RidesTabProps {
  rides: RideWithDetails[];
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
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
}: RidesTabProps) {
  const { t } = useLocale();
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
