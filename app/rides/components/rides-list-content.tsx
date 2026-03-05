import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  Skeleton,
} from "@/components/ui";
import { PassengerRideCard, RidesEmptyState } from "@/components";
import type { UnreadCounts } from "@/lib/utils/unread-counts";
import type { RideSearchMetadata, RideWithDriver } from "@/types";

interface RidesListContentProps {
  loading: boolean;
  rides: RideWithDriver[];
  sortedRides: RideWithDriver[];
  hasFilters: boolean;
  searchMetadata: RideSearchMetadata | null;
  fallbackTitle: string;
  fallbackDescription: string;
  unreadCounts: UnreadCounts;
  user: { id: string } | null;
  onBookingClick: (ride: RideWithDriver) => void;
  onChatClick: (ride: RideWithDriver) => void;
}

const RIDE_CARD_SKELETON_COUNT = 6;

export function RidesListContent({
  loading,
  rides,
  sortedRides,
  hasFilters,
  searchMetadata,
  fallbackTitle,
  fallbackDescription,
  unreadCounts,
  user,
  onBookingClick,
  onChatClick,
}: RidesListContentProps) {
  if (loading) {
    return (
      <div
        className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        data-testid="rides-list-skeleton"
      >
        {Array.from({ length: RIDE_CARD_SKELETON_COUNT }).map((_, i) => (
          <Card key={i} className="overflow-hidden border-0 shadow-xl bg-card">
            <Skeleton className="h-56 w-full rounded-none" />
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start gap-2">
                <Skeleton className="h-5 flex-1 max-w-[140px]" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (rides.length === 0) {
    return <RidesEmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="space-y-4">
      {searchMetadata?.match_type === "corridor_fallback" && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>{fallbackTitle}</AlertTitle>
          <AlertDescription>{fallbackDescription}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {sortedRides.map((ride, index) => (
          <PassengerRideCard
            key={ride.id}
            ride={ride}
            index={index}
            unreadCount={unreadCounts[ride.id] || 0}
            user={user}
            onBookingClick={onBookingClick}
            onChatClick={onChatClick}
          />
        ))}
      </div>
    </div>
  );
}
