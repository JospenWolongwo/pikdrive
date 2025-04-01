"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChat } from "@/providers/ChatProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Plus,
  Users,
  Search,
  X,
  SlidersHorizontal,
  Shield,
  Check,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { ChatDialog } from "@/components/chat/chat-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Phone } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CodeVerificationForm } from "@/components/driver/code-verification-form";
import { PaymentStatusChecker } from "@/components/payment/payment-status-checker";

interface Ride {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  price: number;
  seats_available: number;
  total_seats: number;
  car_model: string;
  car_color: string;
  car_year: number;
  created_at: string;
  bookings: Array<{
    id: string;
    ride_id: string;
    seats: number;
    status: string;
    payment_status?: string;
    code_verified?: boolean;
    transaction_id?: string;
    payment_provider?: string;
    user: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  }>;
  messages: Array<{
    id: string;
    ride_id: string;
    content: string;
    created_at: string;
    sender: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  }>;
}

interface Booking {
  id: string;
  ride_id: string;
  seats: number;
  status: string;
  payment_status?: string;
  code_verified?: boolean;
  transaction_id?: string;
  payment_provider?: string;
  user: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface Message {
  id: string;
  ride_id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface UnreadCount {
  rideId: string;
  count: number;
}

// Utility function for determining status colors
const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "confirmed":
      return "bg-green-500";
    case "pending":
      return "bg-yellow-500";
    case "pending_verification":
      return "bg-purple-500";
    case "cancelled":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

export default function DriverDashboard() {
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const { unreadCounts, subscribeToRide } = useChat();
  const { toast } = useToast();
  const [ridesData, setRidesData] = useState<{
    rides: Ride[];
    lastUpdated: number;
  }>({ rides: [], lastUpdated: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<{
    ride: Ride;
    user: { id: string; full_name: string; avatar_url?: string };
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  const loadRides = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log("🚀 Starting fresh data load");

      // Get all rides without pagination to properly filter upcoming/past
      const { data: simpleRides, error: simpleError } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .order("departure_time", { ascending: true });

      if (simpleError) throw simpleError;
      if (!simpleRides?.length) {
        console.log("💡 No rides found, resetting state");
        setRidesData({ rides: [], lastUpdated: Date.now() });
        return;
      }

      // 2. Fetch related data in parallel for all rides
      const rideIds = simpleRides.map((r: Ride) => r.id);

      const [{ data: bookings }, { data: messages }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, user:profiles(id, full_name, avatar_url)")
          .in("ride_id", rideIds),
        supabase
          .from("messages")
          .select("*, sender:profiles(id, full_name, avatar_url)")
          .in("ride_id", rideIds),
      ]);

      // 3. Combine data with error handling
      const enrichedRides = simpleRides.map((ride: Ride) => ({
        ...ride,
        bookings: bookings?.filter((b: Booking) => b.ride_id === ride.id) || [],
        messages: messages?.filter((m: Message) => m.ride_id === ride.id) || [],
        unreadCount: unreadCounts.find((u: UnreadCount) => u.rideId === ride.id)?.count || 0,
      }));

      console.log("✅ Data load complete");
      setRidesData({
        rides: enrichedRides,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      console.error("❌ Error loading rides:", error);
      toast({
        variant: "destructive",
        title: "Error loading rides",
        description: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  }, [user, supabase, unreadCounts, toast]);

  // Load rides on mount and when user changes
  useEffect(() => {
    const initialLoad = async () => {
      await loadRides();
      router.replace("/driver/dashboard"); // Clear any refresh params
    };

    if (user) initialLoad();
  }, [user, loadRides, router]);

  // Subscribe to messages for each ride
  useEffect(() => {
    ridesData.rides.forEach((ride) => {
      subscribeToRide(ride.id);
    });
  }, [ridesData.rides, subscribeToRide]);

  // Get current time in UTC - wrapped in useMemo to prevent dependency changes on every render
  const nowUTC = useMemo(() => {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      )
    );
  }, []); // Empty dependency array means this only runs once

  // Calculate upcoming and past rides
  const upcomingRides = useMemo(() => {
    console.log(
      "Calculating upcoming rides from",
      ridesData.rides.length,
      "total rides"
    );
    return ridesData.rides
      .filter(
        (ride) => new Date(ride.departure_time).getTime() > nowUTC.getTime()
      )
      .sort(
        (a, b) =>
          new Date(a.departure_time).getTime() -
          new Date(b.departure_time).getTime()
      );
  }, [ridesData.rides, nowUTC]);

  const pastRides = useMemo(() => {
    return ridesData.rides
      .filter(
        (ride) => new Date(ride.departure_time).getTime() <= nowUTC.getTime()
      )
      .sort(
        (a, b) =>
          new Date(b.departure_time).getTime() -
          new Date(a.departure_time).getTime()
      );
  }, [ridesData.rides, nowUTC]);

  // Debug log for overall ride counts
  console.log("Ride counts:", {
    total: ridesData.rides.length,
    upcoming: upcomingRides.length,
    past: pastRides.length,
    current_time: nowUTC.toISOString(),
  });

  const handleOpenChat = (
    ride: Ride,
    user: { id: string; full_name: string; avatar_url?: string }
  ) => {
    setSelectedChat({ ride, user });
  };

  if (loading) {
    return <div className="container py-10">Loading...</div>;
  }

  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ridesData, setRidesData] = useState<{
    rides: Ride[];
    lastUpdated: number;
  }>({
    rides: [],
    lastUpdated: 0,
  });
  // Track unread message counts
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount[]>([]);
  // Add selectedChat state for message handling
  const [selectedChat, setSelectedChat] = useState<{
    ride: Ride | null;
    user: { id: string; full_name: string; avatar_url?: string } | null;
  }>({ ride: null, user: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 5;
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Verification states
  const [verifyingBooking, setVerifyingBooking] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState<{
    bookingId: string;
    transactionId: string;
    provider: string;
  } | null>(null);

  const loadRides = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log("🚀 Starting fresh data load");

      // Get all rides without pagination to properly filter upcoming/past
      const { data: simpleRides, error: simpleError } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .order("departure_time", { ascending: true });

      if (simpleError) throw simpleError;
      if (!simpleRides?.length) {
        console.log("💡 No rides found, resetting state");
        setRidesData({ rides: [], lastUpdated: Date.now() });
        setLoading(false);
        return;
      }

      // 2. Fetch related data in parallel for all rides
      const rideIds = simpleRides.map((r: Ride) => r.id);

      const [{ data: bookings }, { data: messages }] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, user:profiles(id, full_name, avatar_url)")
          .in("ride_id", rideIds),
        supabase
          .from("messages")
          .select("*, sender:profiles(id, full_name, avatar_url)")
          .in("ride_id", rideIds),
      ]);

      // 3. Combine data with error handling
      const enrichedRides = simpleRides.map((ride: Ride) => ({
        ...ride,
        bookings: bookings?.filter((b: Booking) => b.ride_id === ride.id) || [],
        messages: messages?.filter((m: Message) => m.ride_id === ride.id) || [],
        unreadCount: unreadCounts.find((u: UnreadCount) => u.rideId === ride.id)?.count || 0,
      }));

      console.log("✅ Data load complete");
      setRidesData({
        rides: enrichedRides,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      console.error("❌ Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase, unreadCounts]);

  // Load rides on mount and when user changes
  useEffect(() => {
    const initialLoad = async () => {
      await loadRides();
      router.replace("/driver/dashboard"); // Clear any refresh params
    };

    if (user) initialLoad();
  }, [user, loadRides, router]);

  // Get current time in UTC - wrapped in useMemo to prevent dependency changes on every render
  const nowUTC = useMemo(() => {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      )
    );
  }, []); // Empty dependency array means this only runs once

  // Calculate upcoming and past rides with search filtering
  const upcomingRides = useMemo(() => {
    console.log(
      "Calculating upcoming rides from",
      ridesData.rides.length,
      "total rides"
    );

    // First filter by departure time
    const upcoming = ridesData.rides.filter(
      (ride) => new Date(ride.departure_time).getTime() > nowUTC.getTime()
    );

    // Then apply search filter
    const filtered = upcoming.filter((ride) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase().trim();
      return (
        ride.from_city.toLowerCase().includes(query) ||
        ride.to_city.toLowerCase().includes(query) ||
        ride.car_model?.toLowerCase().includes(query) ||
        // Search in bookings
        ride.bookings?.some(
          (booking) =>
            booking.user?.full_name.toLowerCase().includes(query) ||
            booking.status.toLowerCase().includes(query)
        )
      );
    });

    // Finally sort based on departure time (asc or desc)
    return filtered.sort((a, b) => {
      const timeA = new Date(a.departure_time).getTime();
      const timeB = new Date(b.departure_time).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
  }, [ridesData.rides, nowUTC, searchQuery, sortOrder]);

  const pastRides = useMemo(() => {
    // First filter by departure time
    const past = ridesData.rides.filter(
      (ride) => new Date(ride.departure_time).getTime() <= nowUTC.getTime()
    );

    // Then apply search filter
    const filtered = past.filter((ride) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase().trim();
      return (
        ride.from_city.toLowerCase().includes(query) ||
        ride.to_city.toLowerCase().includes(query) ||
        ride.car_model?.toLowerCase().includes(query) ||
        // Search in bookings
        ride.bookings?.some(
          (booking) =>
            booking.user?.full_name.toLowerCase().includes(query) ||
            booking.status.toLowerCase().includes(query)
        )
      );
    });

    // Sort by departure time - past rides are default most recent first
    return filtered.sort((a, b) => {
      const timeA = new Date(a.departure_time).getTime();
      const timeB = new Date(b.departure_time).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
  }, [ridesData.rides, nowUTC, searchQuery, sortOrder]);

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Driver Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your rides and bookings
          </p>
        </div>
        <Button onClick={() => router.push("/driver/rides/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Create Ride
        </Button>
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by city, passenger or car model..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
          />
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                Sort {sortOrder === "asc" ? "Earliest First" : "Latest First"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOrder("asc")}>
                Earliest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("desc")}>
                Latest First
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {searchQuery && (
            <Badge variant="outline" className="flex items-center gap-1">
              <span>
                {searchParams.get("tab") === "past" ||
                (!searchParams.get("tab") && pastRides.length > 0)
                  ? pastRides.length
                  : upcomingRides.length}{" "}
                results
              </span>
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

      <Tabs
        defaultValue="upcoming"
        className="space-y-6"
        onValueChange={(value) => {
          setCurrentPage(1); // Reset to first page when switching tabs
        }}
      >
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming Rides ({upcomingRides.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past Rides ({pastRides.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          {upcomingRides.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Upcoming Rides</CardTitle>
                <CardDescription>
                  {searchQuery
                    ? "No upcoming rides match your search criteria. Try different keywords."
                    : "You haven't created any upcoming rides yet. Create a new ride to get started."}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => router.push("/driver/rides/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Ride
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="space-y-6">
              {upcomingRides
                .slice(
                  (currentPage - 1) * itemsPerPage,
                  currentPage * itemsPerPage
                )
                .map((ride: Ride) => (
                  <Card
                    key={ride.id}
                    className="group hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            {ride.from_city} to {ride.to_city}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(ride.departure_time), "PPP p")}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${ride.price}</div>
                          <div className="text-sm text-muted-foreground">
                            {ride.seats_available} of {ride.total_seats} seats
                            available
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {ride.bookings.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Bookings</h4>
                            <div className="space-y-2">
                              {ride.bookings.map((booking: Booking) => (
                                <div
                                  key={booking.id}
                                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <Avatar>
                                      <AvatarImage
                                        src={
                                          booking.user?.avatar_url || undefined
                                        }
                                        alt={booking.user?.full_name || "User"}
                                      />
                                      <AvatarFallback>
                                        {booking.user?.full_name?.[0]?.toUpperCase() ||
                                          "U"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium">
                                          {booking.user?.full_name}
                                        </p>
                                        <Badge
                                          className={`text-white ${getStatusColor(
                                            booking.status
                                          )}`}
                                        >
                                          {booking.status}
                                        </Badge>
                                        {booking.code_verified && (
                                          <Badge
                                            variant="outline"
                                            className="flex items-center gap-1 bg-green-50"
                                          >
                                            <Check className="h-3 w-3 text-green-500" />
                                            <span className="text-green-700">
                                              Verified
                                            </span>
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>{booking.seats} seats</span>
                                        {booking.payment_status && (
                                          <Badge
                                            variant={
                                              booking.payment_status ===
                                              "completed"
                                                ? "default"
                                                : "secondary"
                                            }
                                          >
                                            Payment:{" "}
                                            {booking.payment_status ===
                                            "completed"
                                              ? "Completed"
                                              : "Pending"}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* Payment verification button */}
                                    {booking.payment_status !== "completed" &&
                                      booking.transaction_id &&
                                      booking.payment_provider && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setCheckingPayment({
                                              bookingId: booking.id,
                                              transactionId:
                                                booking.transaction_id || "",
                                              provider:
                                                booking.payment_provider || "",
                                            })
                                          }
                                        >
                                          <RefreshCw className="h-4 w-4 mr-2" />
                                          Verify Payment
                                        </Button>
                                      )}

                                    {/* Code verification button */}
                                    {!booking.code_verified &&
                                      (booking.status === "pending_verification" ||
                                        booking.status === "pending") && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setVerifyingBooking(
                                              verifyingBooking === booking.id
                                                ? null
                                                : booking.id
                                            )
                                          }
                                        >
                                          <Shield className="h-4 w-4 mr-2" />
                                          {verifyingBooking === booking.id
                                            ? "Cancel"
                                            : "Verify"}
                                        </Button>
                                      )}

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setSelectedChat({ ride, user: booking.user })
                                      }
                                      className="relative"
                                    >
                                      <MessageCircle className="h-4 w-4 mr-2" />
                                      Message
                                      {(() => {
                                        const count = unreadCounts?.find(
                                          (c) => c.rideId === ride.id
                                        )?.count;
                                        return count && count > 0 ? (
                                          <Badge
                                            variant="destructive"
                                            className="ml-2"
                                          >
                                            {count}
                                          </Badge>
                                        ) : null;
                                      })()}
                                    </Button>
                                    <Button variant="default" size="sm">
                                      <Phone className="h-4 w-4 mr-2" />
                                      Call
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {verifyingBooking &&
                          ride.bookings.some(
                            (b) => b.id === verifyingBooking
                          ) && (
                            <Card className="mt-4">
                              <CardHeader>
                                <CardTitle>Verify Passenger</CardTitle>
                                <CardDescription>
                                  Ask the passenger for their verification code
                                  and enter it below.
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <CodeVerificationForm
                                  bookingId={verifyingBooking}
                                  onSuccess={() => {
                                    setVerifyingBooking(null);

                                    // Optimistically update the UI without a full reload
                                    setRidesData((prev) => {
                                      const updatedRides = prev.rides.map(
                                        (ride) => {
                                          const updatedBookings =
                                            ride.bookings.map((b) =>
                                              b.id === verifyingBooking
                                                ? {
                                                    ...b,
                                                    code_verified: true,
                                                    status: "confirmed",
                                                  }
                                                : b
                                            );
                                          return {
                                            ...ride,
                                            bookings: updatedBookings,
                                          };
                                        }
                                      );
                                      return {
                                        ...prev,
                                        rides: updatedRides,
                                        lastUpdated: Date.now(),
                                      };
                                    });
                                  }}
                                />
                              </CardContent>
                            </Card>
                          )}
                        {checkingPayment &&
                          ride.bookings.some(
                            (b) => b.id === checkingPayment.bookingId
                          ) && (
                            <Card className="mt-4">
                              <CardHeader>
                                <CardTitle>Verifying Payment</CardTitle>
                                <CardDescription>
                                  Checking the payment status with the payment
                                  provider...
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <PaymentStatusChecker
                                  transactionId={checkingPayment.transactionId}
                                  provider={checkingPayment.provider}
                                  onPaymentComplete={(status) => {
                                    // If payment is completed, update ride data
                                    if (status === "completed") {
                                      // Optimistically update UI
                                      setRidesData((prev) => {
                                        const updatedRides = prev.rides.map(
                                          (ride) => {
                                            const updatedBookings =
                                              ride.bookings.map((b) =>
                                                b.id ===
                                                checkingPayment.bookingId
                                                  ? {
                                                      ...b,
                                                      payment_status:
                                                        "completed",
                                                    }
                                                  : b
                                              );
                                            return {
                                              ...ride,
                                              bookings: updatedBookings,
                                            };
                                          }
                                        );
                                        return {
                                          ...prev,
                                          rides: updatedRides,
                                          lastUpdated: Date.now(),
                                        };
                                      });
                                    }

                                    // Reset checking state after a delay
                                    setTimeout(() => {
                                      setCheckingPayment(null);
                                    }, 2000);
                                  }}
                                />
                              </CardContent>
                            </Card>
                          )}
                        {ride.messages.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Messages</h4>
                            <div className="space-y-2">
                              {ride.messages.map((message: Message) => (
                                <div
                                  key={message.id}
                                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <Avatar>
                                      <AvatarImage
                                        src={
                                          message.sender?.avatar_url ||
                                          undefined
                                        }
                                        alt={
                                          message.sender?.full_name || "User"
                                        }
                                      />
                                      <AvatarFallback>
                                        {message.sender?.full_name?.[0]?.toUpperCase() ||
                                          "U"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">
                                        {message.sender?.full_name}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {message.content}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/driver/rides/${ride.id}`)}
                      >
                        Manage Ride
                      </Button>
                    </CardFooter>
                  </Card>
                ))}

              {/* Show pagination only if we have more items than itemsPerPage */}
              {upcomingRides.length > 0 && (
                <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    {Math.min(
                      upcomingRides.length,
                      (currentPage - 1) * itemsPerPage + 1
                    )}
                    -
                    {Math.min(upcomingRides.length, currentPage * itemsPerPage)}{" "}
                    of {upcomingRides.length} rides
                  </div>

                  {Math.ceil(upcomingRides.length / itemsPerPage) > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => {
                              if (currentPage > 1)
                                setCurrentPage((prev) => prev - 1);
                            }}
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : ""
                            }
                          />
                        </PaginationItem>

                        {Array.from(
                          {
                            length: Math.min(
                              Math.ceil(upcomingRides.length / itemsPerPage),
                              5
                            ),
                          },
                          (_, i) => {
                            // Show pages around the current page
                            let pageNum;
                            if (
                              Math.ceil(upcomingRides.length / itemsPerPage) <=
                              5
                            ) {
                              pageNum = i + 1;
                            } else {
                              // Calculate start page ensuring we always show 5 pages
                              let startPage = Math.max(
                                1,
                                Math.min(
                                  currentPage - 2,
                                  Math.ceil(
                                    upcomingRides.length / itemsPerPage
                                  ) - 4
                                )
                              );
                              pageNum = startPage + i;
                            }

                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
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
                            onClick={() => {
                              if (
                                currentPage <
                                Math.ceil(upcomingRides.length / itemsPerPage)
                              ) {
                                setCurrentPage((prev) => prev + 1);
                              }
                            }}
                            className={
                              currentPage >=
                              Math.ceil(upcomingRides.length / itemsPerPage)
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-6">
          {pastRides.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Past Rides</CardTitle>
                <CardDescription>
                  {searchQuery
                    ? "No past rides match your search criteria. Try different keywords."
                    : "You don't have any past rides yet."}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-6">
              {pastRides
                .slice(
                  (currentPage - 1) * itemsPerPage,
                  currentPage * itemsPerPage
                )
                .map((ride: Ride) => (
                  <Card key={ride.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            {ride.from_city} to {ride.to_city}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(ride.departure_time), "PPP p")}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${ride.price}</div>
                          <div className="text-sm text-muted-foreground">
                            {ride.total_seats - ride.seats_available} passengers
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {ride.bookings.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Passengers</h4>
                            <div className="space-y-2">
                              {ride.bookings
                                .filter(
                                  (booking) => booking.status === "confirmed"
                                )
                                .map((booking: Booking) => (
                                  <div
                                    key={booking.id}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-muted"
                                  >
                                    <Users className="w-4 h-4" />
                                    <span>{booking.user.full_name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      ({booking.seats}{" "}
                                      {booking.seats === 1 ? "seat" : "seats"})
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

              {/* Show pagination only if we have more items than itemsPerPage */}
              {pastRides.length > 0 && (
                <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    {Math.min(
                      pastRides.length,
                      (currentPage - 1) * itemsPerPage + 1
                    )}
                    -{Math.min(pastRides.length, currentPage * itemsPerPage)} of{" "}
                    {pastRides.length} rides
                  </div>

                  {Math.ceil(pastRides.length / itemsPerPage) > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => {
                              if (currentPage > 1)
                                setCurrentPage((prev) => prev - 1);
                            }}
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : ""
                            }
                          />
                        </PaginationItem>

                        {Array.from(
                          {
                            length: Math.min(
                              Math.ceil(pastRides.length / itemsPerPage),
                              5
                            ),
                          },
                          (_, i) => {
                            // Show pages around the current page
                            let pageNum;
                            if (
                              Math.ceil(pastRides.length / itemsPerPage) <= 5
                            ) {
                              pageNum = i + 1;
                            } else {
                              // Calculate start page ensuring we always show 5 pages
                              let startPage = Math.max(
                                1,
                                Math.min(
                                  currentPage - 2,
                                  Math.ceil(pastRides.length / itemsPerPage) - 4
                                )
                              );
                              pageNum = startPage + i;
                            }

                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
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
                            onClick={() => {
                              if (
                                currentPage <
                                Math.ceil(pastRides.length / itemsPerPage)
                              ) {
                                setCurrentPage((prev) => prev + 1);
                              }
                            }}
                            className={
                              currentPage >=
                              Math.ceil(pastRides.length / itemsPerPage)
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
            </div>
          )}
        </TabsContent>
      </Tabs>
      {selectedChat && selectedChat.ride && selectedChat.user && (
        <ChatDialog
          isOpen={!!selectedChat}
          onClose={() => setSelectedChat({ ride: null, user: null })}
          rideId={selectedChat.ride.id}
          otherUserId={selectedChat.user.id}
          otherUserName={selectedChat.user.full_name}
          otherUserAvatar={selectedChat.user.avatar_url}
        />
      )}
    </div>
  );
}
