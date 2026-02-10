"use client";

import { useCallback } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useLocale } from "@/hooks";
import { Card, CardContent, Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, Skeleton } from "@/components/ui";
import { BookingModal } from "./booking-modal";
import {
  ChatDialog,
  NavigationOverlay,
  PassengerRideCard,
  RidesEmptyState,
  RideFiltersComponent,
} from "@/components";
import {
  useRideFilters,
  useRidesPageData,
  useRideActions,
} from "@/hooks/passenger";

export default function RidesPage() {
  const { user } = useSupabase();
  const { t } = useLocale();

  // Data loading hook (must be first so loadRides/setCurrentPage exist for useRideFilters)
  const {
    loading,
    rides,
    pagination,
    unreadCounts,
    loadRides,
    currentPage,
    setCurrentPage,
  } = useRidesPageData();

  // Filter hook
  const {
    tempFilters,
    showFilters,
    setTempFilters,
    clearAndApplyCityFilter,
    handleSearch,
    handleClear,
    toggleFilters,
  } = useRideFilters(
    useCallback(
      (filters) => {
        setCurrentPage(1);
        loadRides(filters, 1);
      },
      [loadRides, setCurrentPage]
    ),
    useCallback(() => {
      setCurrentPage(1);
    }, [setCurrentPage])
  );

  // Determine if filters are active (for empty state messaging)
  const hasFilters = Boolean(
    (tempFilters.fromCity && tempFilters.fromCity !== "any") ||
      (tempFilters.toCity && tempFilters.toCity !== "any") ||
      tempFilters.minPrice !== 0 ||
      tempFilters.maxPrice !== 20000 ||
      tempFilters.minSeats !== 1
  );

  // Actions hook
  const {
    selectedRide,
    selectedChatRide,
    isNavigating,
    handleBooking,
    handleOpenChat,
    handleBookingComplete,
    setSelectedRide,
    setSelectedChatRide,
  } = useRideActions(
    useCallback(() => {
      loadRides(undefined, currentPage);
    }, [loadRides, currentPage])
  );

  const sortedRides = [...rides].sort(
    (a, b) =>
      new Date(a.departure_time).getTime() -
      new Date(b.departure_time).getTime()
  );

  const RIDE_CARD_SKELETON_COUNT = 6;

  return (
    <div className="container py-6 space-y-6 relative">
      <NavigationOverlay isVisible={isNavigating} />

      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("pages.rides.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("pages.rides.subtitle")}
          </p>
        </div>

        {/* Filters */}
        <RideFiltersComponent
          tempFilters={tempFilters}
          showFilters={showFilters}
          onFilterChange={setTempFilters}
          onClearCityFilter={clearAndApplyCityFilter}
          onSearch={handleSearch}
          onClear={handleClear}
          onToggleFilters={toggleFilters}
        />

        {/* Rides List, Skeleton, or Empty State */}
        {loading ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3" data-testid="rides-list-skeleton">
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
        ) : rides.length === 0 ? (
          <RidesEmptyState hasFilters={hasFilters} />
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {sortedRides.map((ride, index) => (
              <PassengerRideCard
                key={ride.id}
                ride={ride}
                index={index}
                unreadCount={unreadCounts[ride.id] || 0}
                user={user}
                onBookingClick={handleBooking}
                onChatClick={handleOpenChat}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && rides.length > 0 && (
        <Pagination className="mt-4">
          <PaginationContent>
            {pagination.page > 1 && (
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    const newPage = Math.max(1, pagination.page - 1);
                    setCurrentPage(newPage);
                    loadRides(tempFilters, newPage);
                  }}
                />
              </PaginationItem>
            )}

            {Array.from(
              { length: Math.min(5, pagination.totalPages) },
              (_, i) => {
              let pageNumber: number;
                if (pagination.totalPages <= 5) {
                pageNumber = i + 1;
                } else if (pagination.page <= 3) {
                pageNumber = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNumber = pagination.totalPages - 4 + i;
              } else {
                  pageNumber = pagination.page - 2 + i;
              }

              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(pageNumber);
                      loadRides(tempFilters, pageNumber);
                    }}
                      isActive={pagination.page === pageNumber}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
              }
            )}

            {pagination.page < pagination.totalPages && (
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    const newPage = Math.min(pagination.totalPages, pagination.page + 1);
                    setCurrentPage(newPage);
                    loadRides(tempFilters, newPage);
                  }}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}

      {/* Modals */}
      {selectedRide && (
        <BookingModal
          isOpen={!!selectedRide}
          onClose={() => setSelectedRide(null)}
          ride={selectedRide}
          onBookingComplete={handleBookingComplete}
        />
      )}

      {selectedChatRide && (
        <ChatDialog
          isOpen={!!selectedChatRide}
          onClose={() => setSelectedChatRide(null)}
          rideId={selectedChatRide.ride.id}
          conversationId={selectedChatRide.conversationId}
          otherUserId={selectedChatRide.ride.driver_id}
          otherUserName={selectedChatRide.ride.driver?.full_name || "Driver"}
          otherUserAvatar={selectedChatRide.ride.driver?.avatar_url}
        />
      )}
    </div>
  );
}
