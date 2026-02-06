"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, Input, Badge, Button } from "@/components/ui";
import { useToast } from "@/hooks/ui";
import { BookingCard } from "./booking-card";
import { useBookingStore } from "@/stores";
import { useLocale } from "@/hooks";
import { Search, X, RefreshCw } from "lucide-react";

interface Driver {
  full_name: string;
  avatar_url: string;
}

interface DatabaseDriver {
  full_name: string;
  avatar_url?: string;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface Ride {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  car_model: string;
  car_color: string;
  price: number;
  driver: {
    full_name: string;
    avatar_url?: string;
  }[];
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  phone_number: string;
  transaction_id?: string;
  payment_time?: string;
  metadata?: {
    financialTransactionId?: string;
    [key: string]: any;
  };
  status?: string;
}

interface DatabaseRide {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  car_model: string;
  car_color: string;
  price: number;
  driver: DatabaseDriver[];
}

interface DatabaseBooking {
  id: string;
  seats: number;
  status: string;
  payment_status: string;
  created_at: string;
  ride: DatabaseRide;
  payments?: Payment[];
}

interface BookingCardRide extends Omit<DatabaseRide, "driver"> {
  driver: Driver;
}

interface BookingCardBooking extends Omit<DatabaseBooking, "ride"> {
  ride: BookingCardRide;
}

interface BookingWithReceipt extends BookingCardBooking {
  receipt?: {
    id: string;
    payment_id: string;
    created_at: string;
    receipt_number?: string;
    issued_at?: string;
    pdf_url?: string;
  };
}

export function BookingsList({ page }: { page: number }) {
  const { user } = useSupabase();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocale();
  const { 
    userBookings, 
    userBookingsLoading, 
    userBookingsError, 
    fetchUserBookings,
    refreshUserBookings 
  } = useBookingStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [totalBookings, setTotalBookings] = useState(0);
  const itemsPerPage = 10;
  const lastFocusRefetchRef = useRef<number>(0);
  const FOCUS_REFETCH_THROTTLE_MS = 60 * 1000;

  // Create filtered bookings based on search query
  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return userBookings;

    const query = searchQuery.toLowerCase().trim();
    return userBookings.filter((booking) => {
      // Skip bookings without required data
      if (!booking.ride) return false;

      // Search across multiple fields
      return (
        booking.ride.from_city.toLowerCase().includes(query) ||
        booking.ride.to_city.toLowerCase().includes(query) ||
        booking.status.toLowerCase().includes(query) ||
        booking.payment_status?.toLowerCase().includes(query) ||
        booking.ride.driver?.full_name?.toLowerCase().includes(query)
      );
    });
  }, [userBookings, searchQuery]);

  // Count total pages based on filtered results
  const totalPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / itemsPerPage)
  );

  // Get current page items
  const currentPageBookings = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(
      startIndex + itemsPerPage,
      filteredBookings.length
    );
    return filteredBookings.slice(startIndex, endIndex);
  }, [filteredBookings, page, itemsPerPage]);

  const loadBookings = useCallback(
    async (forceRefresh = false) => {
      if (!user) return;
      
      try {
        if (forceRefresh) {
          await refreshUserBookings(user.id);
        } else {
          await fetchUserBookings(user.id);
        }
        
        setTotalBookings(userBookings.length);
      } catch (err) {
        console.error("Error loading bookings:", err);
        toast({
          variant: "destructive",
          title: t("pages.bookings.errorLoading"),
          description: t("pages.bookings.errorLoadingDescription"),
        });
      }
    },
    [user, fetchUserBookings, refreshUserBookings, userBookings.length, toast]
  );

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Refetch when user returns to the tab (throttled to avoid unnecessary refetches)
  useEffect(() => {
    const handleFocus = () => {
      if (!user) return;
      const now = Date.now();
      if (now - lastFocusRefetchRef.current < FOCUS_REFETCH_THROTTLE_MS) return;
      lastFocusRefetchRef.current = now;
      refreshUserBookings(user.id);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, refreshUserBookings]);

  if (userBookingsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">
          {t("pages.bookings.loading")}...
        </p>
      </div>
    );
  }

  if (userBookingsError) {
    return (
      <div className="text-center py-8 text-red-600">
        <h3 className="font-semibold mb-2">
          {t("pages.bookings.errorLoading")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {userBookingsError}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("pages.bookings.searchPlaceholder")}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery && (
          <Badge variant="outline" className="flex items-center gap-1">
            <span>{filteredBookings.length} {t("pages.bookings.results")}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadBookings(true)}
          disabled={userBookingsLoading}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${userBookingsLoading ? "animate-spin" : ""}`} />
          {t("pages.bookings.refresh")}
        </Button>
      </div>

      {!filteredBookings.length ? (
        <div className="text-center py-8">
          <h3 className="font-semibold mb-2">{t("pages.bookings.noBookings")}</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? t("pages.bookings.noSearchResults")
              : t("pages.bookings.noBookingsDesc")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {currentPageBookings
              .filter((booking) => booking.ride)
              .map((booking) => {
                // Only include bookings that have a ride
                const bookingWithPayments = {
                  ...booking,
                  ride: booking.ride!, // We know ride exists because of the filter
                  payments: [], // Initialize empty payments array
                  receipt: undefined, // No receipt by default
                };
                return (
                  <BookingCard
                    key={booking.id}
                    booking={bookingWithPayments}
                  />
                );
              })}
          </div>

          {/* Pagination with results info */}
          <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {t("pages.bookings.pagination.showing")}{" "}
              {Math.min(filteredBookings.length, (page - 1) * itemsPerPage + 1)}
              -{Math.min(filteredBookings.length, page * itemsPerPage)} {t("pages.bookings.pagination.of")}{" "}
              {filteredBookings.length} {t("pages.bookings.pagination.bookings")}
            </div>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  {page > 1 && (
                    <PaginationItem>
                      <PaginationPrevious
                        href={`/bookings?page=${page - 1}`}
                        onClick={(e) => {
                          if (searchQuery) {
                            e.preventDefault();
                            if (page > 1)
                              router.push(`/bookings?page=${page - 1}`);
                          }
                        }}
                      />
                    </PaginationItem>
                  )}

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    // Show pages around the current page
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else {
                      // Calculate start page ensuring we always show 5 pages
                      let startPage = Math.max(
                        1,
                        Math.min(page - 2, totalPages - 4)
                      );
                      pageNum = startPage + i;
                    }

                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href={`/bookings?page=${pageNum}`}
                          isActive={page === pageNum}
                          onClick={(e) => {
                            if (searchQuery) {
                              e.preventDefault();
                              router.push(`/bookings?page=${pageNum}`);
                            }
                          }}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {page < totalPages && (
                    <PaginationItem>
                      <PaginationNext
                        href={`/bookings?page=${page + 1}`}
                        onClick={(e) => {
                          if (searchQuery) {
                            e.preventDefault();
                            if (page < totalPages)
                              router.push(`/bookings?page=${page + 1}`);
                          }
                        }}
                      />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </>
      )}
    </div>
  );
}
