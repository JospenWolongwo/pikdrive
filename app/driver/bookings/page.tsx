"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChat } from "@/providers/ChatProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Phone,
  MapPin,
  Calendar,
  Clock,
  QrCode,
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { ChatDialog } from "@/components/chat/chat-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { CodeVerificationForm } from "@/components/driver/code-verification-form";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Booking {
  id: string;
  ride_id: string;
  seats: number;
  status: string;
  created_at: string;
  payment_status: string;
  user_id: string;
  user: {
    id: string;
    full_name: string;
    avatar_url?: string;
    phone_number?: string;
    email: string;
  };
  ride: {
    id: string;
    from_city: string;
    to_city: string;
    departure_time: string;
    price: number;
    driver_id: string;
  };
}

interface Ride {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  price: number;
  driver_id: string;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  phone_number?: string;
  email: string;
}

interface RawBooking {
  id: string;
  ride_id: string;
  user_id: string;
  seats: number;
  status: string;
  created_at: string;
  payment_status: string | null;
  code_verified?: boolean;
}

interface EnrichedBooking extends RawBooking {
  user: {
    id: string;
    full_name: string;
    avatar_url?: string;
    phone_number?: string;
    email: string | null;
  };
  ride: {
    id: string;
    from_city: string;
    to_city: string;
    departure_time: string;
    price: number;
    driver_id: string | null;
  };
  code_verified?: boolean;
}

export default function DriverBookings() {
  const { supabase, user } = useSupabase();
  const { unreadCounts, subscribeToRide } = useChat();
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBookings, setTotalBookings] = useState(0);
  const itemsPerPage = 5;
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "earliest">("latest");
  const [selectedChat, setSelectedChat] = useState<{
    ride_id: string;
    user: {
      id: string;
      full_name: string;
      avatar_url?: string;
      phone_number?: string;
    };
  } | null>(null);
  const [verifyingBooking, setVerifyingBooking] = useState<string | null>(null);

  // Derived state for pagination
  const totalPages = Math.max(1, Math.ceil(totalBookings / itemsPerPage));

  // Filter and sort bookings
  const filteredAndSortedBookings = useMemo(() => {
    return (
      bookings
        .filter((booking) => {
          if (!searchQuery) return true;

          const searchLower = searchQuery.toLowerCase();
          return (
            booking.user.full_name.toLowerCase().includes(searchLower) ||
            booking.ride.from_city.toLowerCase().includes(searchLower) ||
            booking.ride.to_city.toLowerCase().includes(searchLower) ||
            booking.status.toLowerCase().includes(searchLower) ||
            (booking.payment_status &&
              booking.payment_status.toLowerCase().includes(searchLower))
          );
        })
        // Sort by created_at date based on the current sort order
        .sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return sortOrder === "latest"
            ? dateB - dateA // Latest first
            : dateA - dateB; // Earliest first
        })
    );
  }, [bookings, searchQuery, sortOrder]);

  // Get current page of bookings
  const currentBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedBookings.slice(startIndex, endIndex);
  }, [filteredAndSortedBookings, currentPage, itemsPerPage]);

  const loadBookings = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log("🚗 Loading bookings for driver:", user.id);

      // Get all rides for the driver first (no pagination for rides anymore)
      const { data: rides, error: ridesError } = await supabase
        .from("rides")
        .select("id")
        .eq("driver_id", user.id);

      if (ridesError) {
        console.error("❌ Error fetching driver rides:", ridesError);
        setLoading(false);
        return;
      }

      if (!rides?.length) {
        console.log("ℹ️ No rides found for driver");
        setBookings([]);
        setLoading(false);
        return;
      }

      const rideIds = rides.map((r: { id: string }) => r.id);
      console.log(`🔍 Found ${rideIds.length} rides, fetching bookings`);

      // Get all data in parallel
      const [
        { data: rawBookings, error: bookingsError },
        { data: bookingRides, error: ridesDataError },
      ] = await Promise.all([
        // Get all bookings for the driver's rides
        supabase
          .from("bookings")
          .select(
            "id, ride_id, user_id, seats, status, created_at, payment_status, code_verified"
          )
          .in("ride_id", rideIds),

        // Get full ride details
        supabase.from("rides").select("*").in("id", rideIds),
      ]);

      if (bookingsError) {
        console.error("❌ Error fetching bookings:", bookingsError);
        setLoading(false);
        return;
      }

      if (ridesDataError) {
        console.error("❌ Error fetching ride details:", ridesDataError);
        setLoading(false);
        return;
      }

      if (!rawBookings?.length) {
        console.log("ℹ️ No bookings found for driver's rides");
        setBookings([]);
        setLoading(false);
        return;
      }

      console.log(`✅ Found ${rawBookings.length} bookings`);

      // Debug raw booking data in detail
      console.log(
        "🔎 Raw Bookings Data:",
        JSON.stringify(rawBookings, null, 2)
      );

      // Get all user IDs from bookings
      const userIds = [
        ...new Set(rawBookings.map((b: RawBooking) => b.user_id)),
      ];

      // Fetch user profiles
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone_number, email")
        .in("id", userIds);

      if (usersError) {
        console.error("❌ Error fetching user profiles:", usersError);
      }

      // Create lookup maps for rides and users
      const rideMap = new Map(bookingRides?.map((r: Ride) => [r.id, r]) || []);
      const userMap = new Map(users?.map((u: Profile) => [u.id, u]) || []);

      // Combine data to create enriched bookings
      const enrichedBookings = rawBookings.map((booking: RawBooking) => {
        const userProfile = userMap.get(booking.user_id);
        const rideDetails = rideMap.get(booking.ride_id);

        // Ensure code_verified is properly handled as boolean
        // (it might be coming as null from database)
        const code_verified = booking.code_verified === true;

        return {
          ...booking,
          code_verified,
          user: userProfile || {
            id: booking.user_id,
            full_name: "Unknown User",
            avatar_url: undefined,
            phone_number: undefined,
            email: null,
          },
          ride: rideDetails || {
            id: booking.ride_id,
            from_city: "Unknown",
            to_city: "Unknown",
            departure_time: new Date().toISOString(),
            price: 0,
            driver_id: user.id,
          },
        };
      });

      console.log(`🔄 Setting ${enrichedBookings.length} enriched bookings`);

      // Set total bookings for pagination and reset to page 1 if needed
      setTotalBookings(enrichedBookings.length);
      if (currentPage > Math.ceil(enrichedBookings.length / itemsPerPage)) {
        setCurrentPage(1);
      }

      // Use functional update to ensure atomic state update
      setBookings((prev) => {
        // Only update if there are actual changes
        const hasChanges =
          JSON.stringify(prev) !== JSON.stringify(enrichedBookings);
        return hasChanges ? enrichedBookings : prev;
      });
    } catch (error) {
      console.error("❌ Error in loadBookings:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase, currentPage]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [loadBookings, user]);

  // Subscribe to bookings changes
  useEffect(() => {
    if (!user) return;

    console.log("🎧 Setting up booking subscriptions...");

    // Subscribe to new bookings for any of the driver's rides
    const bookingsSubscription = supabase
      .channel("bookings-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
        },
        async (
          payload: RealtimePostgresChangesPayload<{ [key: string]: any }>
        ) => {
          console.log("📬 Received booking update:", payload);
          await loadBookings();
        }
      )
      .subscribe(
        (status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => {
          console.log("📡 Bookings subscription status:", status);
        }
      );

    // Subscribe to payment status changes
    const paymentsSubscription = supabase
      .channel("payments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        async (
          payload: RealtimePostgresChangesPayload<{ [key: string]: any }>
        ) => {
          console.log("💰 Payment update received:", payload);
          await loadBookings();
        }
      )
      .subscribe(
        (status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => {
          console.log("📡 Payments subscription status:", status);
        }
      );

    return () => {
      console.log("👋 Cleaning up subscriptions...");
      bookingsSubscription.unsubscribe();
      paymentsSubscription.unsubscribe();
    };
  }, [user, supabase, loadBookings]);

  // Subscribe to messages for each booking's ride
  useEffect(() => {
    if (!bookings.length) return;

    const rideIds = new Set(bookings.map((b) => b.ride_id));
    console.log(
      "💬 Setting up message subscriptions for rides:",
      Array.from(rideIds)
    );
    rideIds.forEach((rideId) => {
      subscribeToRide(rideId);
    });
  }, [bookings, subscribeToRide]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return <div className="container mx-auto py-10">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      <h1 className="text-2xl font-bold">Mes Trajets</h1>

      {/* Search and filter bar */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher par passager, ville ou statut..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
          />
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Trier:{" "}
              {sortOrder === "latest"
                ? "Plus récent d'abord"
                : "Plus ancien d'abord"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOrder("latest")}>
              Plus récent d'abord
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder("earliest")}>
              Plus ancien d'abord
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div>
          {searchQuery && (
            <Badge variant="outline" className="flex items-center gap-1">
              <span>{filteredAndSortedBookings.length} résultats</span>
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
      </div>

      <div className="space-y-6">
        {currentBookings.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Bookings Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Aucune réservation ne correspond à votre recherche. Essayez d'autres mots-clés."
                  : "Vous n'avez pas encore de réservations."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {currentBookings.map((booking: EnrichedBooking) => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        {booking.ride.from_city} to {booking.ride.to_city}
                      </CardTitle>
                      <div className="space-y-1 mt-2">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Departure:{" "}
                          {format(
                            new Date(booking.ride.departure_time),
                            "PPP p"
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Booked:{" "}
                          {format(new Date(booking.created_at), "PPP p")}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <Badge className={getStatusColor(booking.status)}>
                        Booking: {booking.status}
                      </Badge>
                      {booking.payment_status && (
                        <div>
                          <Badge
                            variant={
                              booking.payment_status === "completed"
                                ? "default"
                                : "secondary"
                            }
                          >
                            Payment:{" "}
                            {booking.payment_status === "completed"
                              ? "Completed"
                              : "Pending"}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar>
                          <AvatarImage
                            src={
                              booking.user.avatar_url || "/defaults/avatar.svg"
                            }
                            alt={booking.user.full_name}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium">
                            {booking.user.full_name?.charAt(0).toUpperCase() ||
                              "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">
                            {booking.user.full_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {booking.seats}{" "}
                            {booking.seats === 1 ? "seat" : "seats"} •{" "}
                            {formatCurrency(booking.ride.price * booking.seats)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {booking.user.phone_number && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`tel:${booking.user.phone_number}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedChat({
                            ride_id: booking.ride_id,
                            user: booking.user,
                          })
                        }
                        className="relative"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Message
                        {(unreadCounts.find(
                          (c) => c.rideId === booking.ride_id && booking.user_id
                        )?.count || 0) > 0 && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full"
                          >
                            {unreadCounts.find(
                              (c) =>
                                c.rideId === booking.ride_id && booking.user_id
                            )?.count || 0}
                          </Badge>
                        )}
                      </Button>

                      {/* Show verify button for bookings that require verification */}
                      {booking.status === "pending_verification" &&
                        booking.code_verified !== true &&
                        String(booking.payment_status).toLowerCase() ===
                          "completed" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setVerifyingBooking(
                                verifyingBooking === booking.id
                                  ? null
                                  : booking.id
                              )
                            }
                            className="relative"
                          >
                            <QrCode className="h-4 w-4 mr-2" />
                            {verifyingBooking === booking.id ? (
                              "Cancel"
                            ) : (
                              <>
                                <span className="hidden sm:inline">
                                  Verify Passenger
                                </span>
                                <span className="sm:hidden">Verify</span>
                              </>
                            )}
                          </Button>
                        )}
                    </div>
                  </div>

                  {/* Verification form */}
                  {verifyingBooking === booking.id && (
                    <div className="mt-4">
                      <CodeVerificationForm
                        bookingId={booking.id}
                        onSuccess={() => {
                          setVerifyingBooking(null);
                          // Update the local state to avoid having to reload all data
                          setBookings((prev) =>
                            prev.map((b) =>
                              b.id === booking.id
                                ? {
                                    ...b,
                                    code_verified: true,
                                    status: "confirmed",
                                  }
                                : b
                            )
                          );
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Pagination with results count */}
            {filteredAndSortedBookings.length > 0 && (
              <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Affichage de {currentPage * itemsPerPage - itemsPerPage + 1} à{" "}
                  {Math.min(
                    currentPage * itemsPerPage,
                    filteredAndSortedBookings.length
                  )}{" "}
                  sur {filteredAndSortedBookings.length} réservations
                </span>

                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) {
                              setCurrentPage((prev) => prev - 1);
                            }
                          }}
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : ""
                          }
                        />
                      </PaginationItem>

                      {Array.from(
                        { length: Math.min(totalPages, 5) },
                        (_, i) => {
                          // Show pages around the current page if we have more than 5 pages
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else {
                            // Calculate start page ensuring we always show 5 pages
                            let startPage = Math.max(
                              1,
                              Math.min(currentPage - 2, totalPages - 4)
                            );
                            pageNum = startPage + i;
                          }
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(pageNum);
                                }}
                                isActive={currentPage === pageNum}
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                      )}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) {
                              setCurrentPage((prev) => prev + 1);
                            }
                          }}
                          className={
                            currentPage === totalPages
                              ? "pointer-events-none opacity-50"
                              : ""
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedChat && (
        <ChatDialog
          isOpen={!!selectedChat}
          onClose={() => setSelectedChat(null)}
          rideId={selectedChat.ride_id}
          otherUserId={selectedChat.user.id}
          otherUserName={selectedChat.user.full_name}
          otherUserAvatar={selectedChat.user.avatar_url}
        />
      )}
    </div>
  );
}
