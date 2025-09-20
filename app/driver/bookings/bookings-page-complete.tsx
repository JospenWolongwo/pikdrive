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
  RefreshCw,
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
import { useToast } from "@/hooks/ui";

// Import our new centralized driver bookings hook
import { useDriverBookings } from "@/hooks/driver";
import type { DriverBooking, RideWithDriverBookings } from "@/types";

/**
 * Complete migrated driver bookings page with ALL original features
 * This includes real-time subscriptions, sorting, verification, and more
 */
export default function DriverBookingsPageComplete() {
  const { supabase, user } = useSupabase();
  const { unreadCounts, subscribeToRide } = useChat();
  const { toast } = useToast();

  // Use our centralized driver bookings hook
  const {
    bookings: ridesWithBookings,
    loading,
    error,
    refreshBookings,
    loadBookings,
  } = useDriverBookings();

  // Local state (matching original exactly)
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "earliest">("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedChat, setSelectedChat] = useState<{
    ride_id: string;
    user: {
      id: string;
      full_name: string;
      avatar_url?: string;
      phone?: string;
    };
  } | null>(null);
  const [verifyingBooking, setVerifyingBooking] = useState<string | null>(null);

  const itemsPerPage = 5; // Match original

  // Flatten all bookings from all rides
  const allBookings = useMemo(() => {
    const bookings: DriverBooking[] = [];
    ridesWithBookings.forEach(ride => {
      ride.bookings?.forEach(booking => {
        bookings.push({
          ...booking,
          ride: {
            id: ride.id,
            from_city: ride.from_city,
            to_city: ride.to_city,
            departure_time: ride.departure_time,
            price: ride.price,
          },
        });
      });
    });
    return bookings;
  }, [ridesWithBookings]);

  // Filter and sort bookings (matching original logic exactly)
  const filteredAndSortedBookings = useMemo(() => {
    return (
      allBookings
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
  }, [allBookings, searchQuery, sortOrder]);

  // Pagination (matching original logic exactly)
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedBookings.length / itemsPerPage));
  const currentBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedBookings.slice(startIndex, endIndex);
  }, [filteredAndSortedBookings, currentPage, itemsPerPage]);

  // Load bookings on mount
  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Subscribe to messages for each ride
  useEffect(() => {
    if (!allBookings.length) return;

    const rideIds = new Set(allBookings.map((b) => b.ride_id));
    console.log(
      "💬 Setting up message subscriptions for rides:",
      Array.from(rideIds)
    );
    rideIds.forEach((rideId) => {
      subscribeToRide(rideId);
    });
  }, [allBookings, subscribeToRide]);

  // Subscribe to real-time updates (matching original exactly)
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
          await refreshBookings(); // Force refresh on real-time updates
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
          await refreshBookings(); // Force refresh on real-time updates
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
  }, [user, supabase, refreshBookings]);

  // Handle chat (matching original)
  const handleOpenChat = (booking: DriverBooking) => {
    setSelectedChat({
      ride_id: booking.ride_id,
      user: booking.user,
    });
  };

  // Handle refresh (matching original)
  const handleRefresh = useCallback(() => {
    refreshBookings();
  }, [refreshBookings]);

  // Status color function (matching original exactly)
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

      {/* Search and filter bar (matching original exactly) */}
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

        {/* Sort dropdown (matching original) */}
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

        {/* Refresh button (matching original) */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>

        {/* Search results badge (matching original) */}
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
              <CardTitle>Aucune réservation trouvée</CardTitle>
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
            {currentBookings.map((booking: DriverBooking) => (
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
                      {/* Phone call button (matching original) */}
                      {booking.user.phone && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`tel:${booking.user.phone}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </a>
                        </Button>
                      )}
                      
                      {/* Message button with unread count (matching original) */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenChat(booking)}
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

                      {/* Verification button (matching original) */}
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

                  {/* Verification form (matching original) */}
                  {verifyingBooking === booking.id && (
                    <div className="mt-4">
                      <CodeVerificationForm
                        bookingId={booking.id}
                        onSuccess={() => {
                          setVerifyingBooking(null);
                          handleRefresh();
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Pagination with results count (matching original exactly) */}
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

      {/* Chat Dialog (matching original) */}
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
