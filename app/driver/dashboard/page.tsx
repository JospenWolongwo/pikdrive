"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChatStore } from "@/stores/chatStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ChatDialog } from "@/components/chat/chat-dialog";
import { CodeVerificationForm } from "@/components/driver/code-verification-form";
import { PaymentStatusChecker } from "@/components/payment/payment-status-checker";
import { PageLoader } from "@/components/ui/page-loader";
import { ContentLoader } from "@/components/ui/content-loader";

// Dashboard components
import { DashboardHeader } from "@/components/driver/dashboard/dashboard-header";
import { CancellationNotifications } from "@/components/driver/dashboard/cancellation-notifications";
import { SearchAndFilters } from "@/components/driver/dashboard/search-and-filters";
import { RidesTab } from "@/components/driver/dashboard/rides-tab";
import { PaymentStatistics } from "@/components/driver/dashboard/payment-statistics";

// Custom hooks - using centralized rides store
import { useNotificationPromptTrigger } from "@/hooks/notifications/useNotificationPrompt";
import { useToast, useRidesStoreData, useRidesFilteringStore, useLocale } from "@/hooks";

// Types
import type {
  RideWithDetails,
  PaymentCheckRequest,
} from "@/types";

export default function DriverDashboard() {
  const router = useRouter();
  const { user, supabase } = useSupabase();
  const { t } = useLocale();
  const { subscribeToRide, conversations } = useChatStore();
  const { toast } = useToast();
  const { triggerPrompt } = useNotificationPromptTrigger();


  // State
  const [selectedChat, setSelectedChat] = useState<{
    ride: RideWithDetails;
    user: { id: string; full_name: string | null; avatar_url?: string };
    conversationId: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [verifyingBooking, setVerifyingBooking] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] =
    useState<PaymentCheckRequest | null>(null);

  const itemsPerPage = 10;

  // Custom hooks - using centralized rides store
  const {
    ridesData,
    loading,
    cancelledBookings,
    loadRides,
    refreshRides,
    nowUTC,
  } = useRidesStoreData();
  
  // Use the filtering hook to get search and sort filtered rides
  const { upcomingRides, pastRides } = useRidesFilteringStore({
    rides: ridesData.rides,
    nowUTC,
    searchQuery,
    sortOrder,
  });


  // Subscribe to messages for each ride's conversation
  useEffect(() => {
    ridesData.rides.forEach((ride) => {
      // Find the conversation for this ride
      const conversation = conversations.find(conv => conv.rideId === ride.id);
      if (conversation) {
        subscribeToRide(conversation.id);
      }
    });
  }, [ridesData.rides, conversations, subscribeToRide]);

  // Load rides on mount and when user changes
  useEffect(() => {
    const initialLoad = async () => {
      // Only load if data is not already available (smart caching)
      await loadRides(false); // Use cache if fresh, only fetch if needed
      router.replace("/driver/dashboard");
      
      // Trigger notification prompt after dashboard loads
      // Use priority=false to respect 24h cooldown (not as critical as ride creation)
      // This catches drivers who haven't created rides yet
      triggerPrompt(false);
    };

    if (user) initialLoad();
  }, [user, loadRides, router, triggerPrompt]);

  // Note: Booking notifications are handled by OneSignal via server-side triggers

  const handleOpenChat = (
    ride: RideWithDetails,
    user: { id: string; full_name: string | null; avatar_url?: string }
  ) => {
    // Find the conversation for this ride and user
    const conversation = conversations.find(conv => 
      conv.rideId === ride.id && conv.otherUserId === user.id
    );
    
    if (conversation) {
      setSelectedChat({ ride, user, conversationId: conversation.id });
    } else {
      // If no conversation exists, we'll need to create one
      // For now, we'll use the rideId as a fallback and let the ChatDialog handle creation
      setSelectedChat({ ride, user, conversationId: ride.id });
    }
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
      // Check if the ride has any bookings at all
      const ride = ridesData.rides.find((r) => r.id === rideId);
      if (ride && ride.bookings.length > 0) {
        toast({
          title: "Suppression impossible",
          description:
            "Vous ne pouvez pas supprimer un trajet avec des réservations.",
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
        await refreshRides();
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <PageLoader message="Chargement de vos trajets" />;
  }


  return (
    <div className="container py-4 sm:py-6 space-y-4 sm:space-y-6 px-4 sm:px-6">
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

      <Suspense fallback={<ContentLoader size="lg" message="Chargement des trajets..." />}>
        {/* Tabs for upcoming and past rides */}
        <Tabs
          defaultValue="upcoming"
          className="space-y-4 sm:space-y-6"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming" className="text-sm sm:text-base">
              {t("pages.driver.dashboard.tabs.upcoming")}
            </TabsTrigger>
            <TabsTrigger value="past" className="text-sm sm:text-base">
              {t("pages.driver.dashboard.tabs.past")}
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-sm sm:text-base">
              {t("pages.driver.dashboard.tabs.payments")}
            </TabsTrigger>
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

          <TabsContent value="payments" className="space-y-6">
            <PaymentStatistics />
          </TabsContent>
        </Tabs>
      </Suspense>

      {/* Chat Dialog */}
      {selectedChat && selectedChat.ride && selectedChat.user && (
        <ChatDialog
          isOpen={!!selectedChat}
          onClose={handleCloseChat}
          rideId={selectedChat.ride.id}
          conversationId={selectedChat.conversationId}
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
          bookingId={checkingPayment.bookingId} // Pass bookingId for resilient fallback queries
          onPaymentComplete={(status) => {
            if (status === "completed") {
              setCheckingPayment(null);
              loadRides();
            }
          }}
        />
      )}

      {/* Code Verification Form Dialog */}
      <Dialog
        open={!!verifyingBooking}
        onOpenChange={(open) => {
          if (!open) {
            setVerifyingBooking(null);
          }
        }}
      >
        <DialogContent>
          {verifyingBooking && (
            <CodeVerificationForm
              bookingId={verifyingBooking}
              onSuccess={async () => {
                setVerifyingBooking(null);
                // Refresh rides data immediately to update UI (disable verify button)
                await loadRides(true); // Force refresh to get latest booking data
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
