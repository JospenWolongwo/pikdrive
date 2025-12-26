import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChatStore } from "@/stores/chatStore";
import { useToast } from "@/hooks/ui";
import type { RideWithDriver } from "@/types";

interface SelectedChatRide {
  ride: RideWithDriver;
  conversationId: string;
}

interface UseRideActionsReturn {
  selectedRide: RideWithDriver | null;
  selectedChatRide: SelectedChatRide | null;
  isNavigating: boolean;
  handleBooking: (ride: RideWithDriver) => void;
  handleOpenChat: (ride: RideWithDriver) => void;
  handleBookingComplete: (onComplete?: () => void) => void;
  setSelectedRide: (ride: RideWithDriver | null) => void;
  setSelectedChatRide: (chatRide: SelectedChatRide | null) => void;
}

export function useRideActions(
  onBookingComplete?: () => void
): UseRideActionsReturn {
  const { user } = useSupabase();
  const router = useRouter();
  const { toast } = useToast();
  const { conversations } = useChatStore();
  const [selectedRide, setSelectedRide] = useState<RideWithDriver | null>(
    null
  );
  const [selectedChatRide, setSelectedChatRide] =
    useState<SelectedChatRide | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleBooking = useCallback(
    (ride: RideWithDriver) => {
      if (!user) {
        toast({
          title: "Connexion requise",
          description: "Veuillez vous connecter pour réserver un trajet.",
          variant: "destructive",
        });
        setIsNavigating(true);
        router.replace("/auth?redirect=/rides");
        return;
      }
      setSelectedRide(ride);
    },
    [user, router, toast]
  );

  const handleOpenChat = useCallback(
    (ride: RideWithDriver) => {
      if (!user) {
        toast({
          title: "Connexion requise",
          description: "Veuillez vous connecter pour contacter le conducteur.",
          variant: "destructive",
        });
        setIsNavigating(true);
        router.replace("/auth?redirect=/rides");
        return;
      }

      // Find the conversation for this ride and driver
      const conversation = conversations.find(
        (conv) => conv.rideId === ride.id && conv.otherUserId === ride.driver_id
      );

      if (conversation) {
        setSelectedChatRide({ ride, conversationId: conversation.id });
      } else {
        // If no conversation exists, we'll need to create one
        // For now, we'll use the rideId as a fallback and let the ChatDialog handle creation
        setSelectedChatRide({ ride, conversationId: ride.id });
      }
    },
    [user, router, toast, conversations]
  );

  const handleBookingComplete = useCallback(() => {
    setSelectedRide(null);
    if (onBookingComplete) {
      onBookingComplete();
    }
  }, [onBookingComplete]);

  // Reset navigation state when user changes
  useEffect(() => {
    setIsNavigating(false);
  }, [user]);

  return {
    selectedRide,
    selectedChatRide,
    isNavigating,
    handleBooking,
    handleOpenChat,
    handleBookingComplete,
    setSelectedRide,
    setSelectedChatRide,
  };
}

