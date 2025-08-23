"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChat } from "@/providers/ChatProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ChatDialog } from "@/components/chat/chat-dialog";
import { CodeVerificationForm } from "@/components/driver/code-verification-form";
import { PaymentStatusChecker } from "@/components/payment/payment-status-checker";

// Dashboard components
import { DashboardHeader } from "@/components/driver/dashboard/dashboard-header";
import { CancellationNotifications } from "@/components/driver/dashboard/cancellation-notifications";
import { SearchAndFilters } from "@/components/driver/dashboard/search-and-filters";
import { RidesTab } from "@/components/driver/dashboard/rides-tab";

// Custom hooks
import { useRidesData } from "@/components/driver/dashboard/use-rides-data";
import { useRidesFiltering } from "@/components/driver/dashboard/use-rides-filtering";
import {
  initializeGlobalBookingNotificationManager,
  cleanupGlobalBookingNotificationManager,
} from "@/lib/notifications/booking-notification-manager";

// Types
import type {
  Ride,
  PaymentCheckRequest,
} from "@/components/driver/dashboard/types";

export default function DriverDashboard() {
  const router = useRouter();
  const { user, supabase } = useSupabase();
  const { subscribeToRide } = useChat();
  const { toast } = useToast();

  // State
  const [selectedChat, setSelectedChat] = useState<{
    ride: Ride;
    user: { id: string; full_name: string; avatar_url?: string };
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [verifyingBooking, setVerifyingBooking] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] =
    useState<PaymentCheckRequest | null>(null);

  const itemsPerPage = 10;

  // Custom hooks
  const { ridesData, loading, cancelledBookings, loadRides, nowUTC } =
    useRidesData();
  const { upcomingRides, pastRides } = useRidesFiltering(
    ridesData.rides,
    nowUTC,
    searchQuery,
    sortOrder
  );

  // Subscribe to messages for each ride
  useEffect(() => {
    ridesData.rides.forEach((ride) => {
      subscribeToRide(ride.id);
    });
  }, [ridesData.rides, subscribeToRide]);

  // Load rides on mount and when user changes
  useEffect(() => {
    const initialLoad = async () => {
      await loadRides();
      router.replace("/driver/dashboard"); // Clear any refresh params
    };

    if (user) initialLoad();
  }, [user, loadRides, router]);

  // Set up global booking notification manager for drivers
  useEffect(() => {
    if (!user || typeof window === "undefined") {
      cleanupGlobalBookingNotificationManager();
      return;
    }

    // Prevent multiple managers from starting
    if (window.__bookingNotificationManager) {
      return;
    }

    const manager = initializeGlobalBookingNotificationManager(
      supabase,
      user.id,
      () => {
        // Navigate to driver dashboard when notification is clicked
        router.push("/driver/dashboard");
      }
    );

    try {
      manager.start();
      console.log("🚗 BookingNotificationManager started for driver dashboard");
    } catch (error) {
      console.error("❌ Failed to start BookingNotificationManager:", error);
    }

    return () => {
      cleanupGlobalBookingNotificationManager();
    };
  }, [user, supabase, router]);

  const handleOpenChat = (
    ride: Ride,
    user: { id: string; full_name: string; avatar_url?: string }
  ) => {
    setSelectedChat({ ride, user });
  };

  const handleVerifyCode = (bookingId: string) => {
    setVerifyingBooking(bookingId);
  };

  const handleCheckPayment = (booking: {
    id: string;
    transaction_id?: string;
    payment_provider?: string;
  }) => {
    if (booking.transaction_id && booking.payment_provider) {
      setCheckingPayment({
        bookingId: booking.id,
        transactionId: booking.transaction_id,
        provider: booking.payment_provider,
      });
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleSortChange = (order: "asc" | "desc") => {
    setSortOrder(order);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCloseChat = () => {
    setSelectedChat(null);
  };

  const handleDeleteRide = async (rideId: string) => {
    try {
      // Check if the ride has active bookings
      const ride = ridesData.rides.find((r) => r.id === rideId);
      if (
        ride &&
        ride.bookings.some(
          (b) =>
            b.status === "confirmed" ||
            b.status === "pending" ||
            b.status === "pending_verification" ||
            b.payment_status === "completed" ||
            b.payment_status === "paid"
        )
      ) {
        // Check if there are paid bookings
        const hasPaidBookings = ride.bookings.some(
          (b) => b.payment_status === "completed" || b.payment_status === "paid"
        );

        const hasActiveBookings = ride.bookings.some(
          (b) =>
            b.status === "confirmed" ||
            b.status === "pending" ||
            b.status === "pending_verification"
        );

        let description = "";
        if (hasPaidBookings) {
          description =
            "Vous ne pouvez pas supprimer un trajet avec des réservations payées.";
        } else if (hasActiveBookings) {
          description =
            "Vous ne pouvez pas supprimer un trajet avec des réservations actives.";
        }

        toast({
          title: "Suppression impossible",
          description,
          variant: "destructive",
        });
        return;
      }

      // Confirm deletion
      if (confirm("Êtes-vous sûr de vouloir supprimer ce trajet ?")) {
        const { error } = await supabase
          .from("rides")
          .delete()
          .eq("id", rideId)
          .eq("driver_id", user.id);

        if (error) {
          console.error("❌ Error deleting ride:", error);
          toast({
            title: "Erreur",
            description:
              "Impossible de supprimer le trajet. Veuillez réessayer.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Trajet supprimé",
          description: "Le trajet a été supprimé avec succès",
        });

        // Reload rides
        await loadRides();
      }
    } catch (error) {
      console.error("❌ Error in delete process:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="container py-10">Chargement...</div>;
  }

  return (
    <div className="container py-6 space-y-6">
      <DashboardHeader />

      {/* Cancellation Notifications */}
      <CancellationNotifications cancelledBookings={cancelledBookings} />

      {/* Search and filter bar */}
      <SearchAndFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />

      {/* Tabs for upcoming and past rides */}
      <Tabs
        defaultValue="upcoming"
        className="space-y-6"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">Trajets à venir</TabsTrigger>
          <TabsTrigger value="past">Trajets passés</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          <RidesTab
            rides={upcomingRides}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onOpenChat={handleOpenChat}
            onVerifyCode={handleVerifyCode}
            onCheckPayment={handleCheckPayment}
            onDeleteRide={handleDeleteRide}
            isPastRide={false}
            searchQuery={searchQuery}
          />
        </TabsContent>

        <TabsContent value="past" className="space-y-6">
          <RidesTab
            rides={pastRides}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onOpenChat={handleOpenChat}
            onVerifyCode={handleVerifyCode}
            onCheckPayment={handleCheckPayment}
            onDeleteRide={handleDeleteRide}
            isPastRide={true}
            searchQuery={searchQuery}
          />
        </TabsContent>
      </Tabs>

      {/* Chat Dialog */}
      {selectedChat && selectedChat.ride && selectedChat.user && (
        <ChatDialog
          isOpen={!!selectedChat}
          onClose={handleCloseChat}
          rideId={selectedChat.ride.id}
          otherUserId={selectedChat.user.id}
          otherUserName={selectedChat.user.full_name}
          otherUserAvatar={selectedChat.user.avatar_url}
        />
      )}

      {/* Payment Status Checker */}
      {checkingPayment && (
        <PaymentStatusChecker
          transactionId={checkingPayment.transactionId}
          provider={checkingPayment.provider}
          onPaymentComplete={(status) => {
            if (status === "completed") {
              setCheckingPayment(null);
              loadRides();
            }
          }}
        />
      )}

      {/* Code Verification Form */}
      {verifyingBooking && (
        <CodeVerificationForm
          bookingId={verifyingBooking}
          onSuccess={() => {
            setVerifyingBooking(null);
            loadRides();
          }}
        />
      )}
    </div>
  );
}
