"use client";

import { useCallback } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useLocale } from "@/hooks";
import { NavigationOverlay, RideFiltersComponent } from "@/components";
import {
  useRideFilters,
  useRidesPageData,
  useRideActions,
} from "@/hooks/passenger";
import { RidesListContent } from "./components/rides-list-content";
import { RidesPagination } from "./components/rides-pagination";
import { RidesModals } from "./components/rides-modals";
import type { RideWithDriver } from "@/types";

export default function RidesPage() {
  const { user } = useSupabase();
  const { t } = useLocale();

  // Data loading hook (must be first so loadRides/setCurrentPage exist for useRideFilters)
  const {
    loading,
    rides,
    pagination,
    searchMetadata,
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

  const ridesWithDriver = rides as RideWithDriver[];
  const sortedRides = [...ridesWithDriver].sort(
    (a, b) =>
      new Date(a.departure_time).getTime() -
      new Date(b.departure_time).getTime()
  );

  const fallbackTitle = t("pages.rides.fallbackNotice.title");
  const fallbackDescription = t("pages.rides.fallbackNotice.description", {
    requestedFromCity: searchMetadata?.requested_from_city || "",
    requestedToCity: searchMetadata?.requested_to_city || "",
  });

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

        <RidesListContent
          loading={loading}
          rides={ridesWithDriver}
          sortedRides={sortedRides}
          hasFilters={hasFilters}
          searchMetadata={searchMetadata}
          fallbackTitle={fallbackTitle}
          fallbackDescription={fallbackDescription}
          unreadCounts={unreadCounts}
          user={user}
          onBookingClick={handleBooking}
          onChatClick={handleOpenChat}
        />
      </div>

      <RidesPagination
        loading={loading}
        ridesCount={rides.length}
        pagination={pagination}
        onPageChange={(pageNumber) => {
          setCurrentPage(pageNumber);
          loadRides(tempFilters, pageNumber);
        }}
      />

      <RidesModals
        selectedRide={selectedRide}
        selectedChatRide={selectedChatRide}
        onCloseBooking={() => setSelectedRide(null)}
        onBookingComplete={handleBookingComplete}
        onCloseChat={() => setSelectedChatRide(null)}
      />
    </div>
  );
}
