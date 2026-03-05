import { BookingModal } from "../booking-modal";
import { ChatDialog } from "@/components";
import type { RideWithDriver } from "@/types";

interface SelectedChatRide {
  ride: RideWithDriver;
  conversationId: string;
}

interface RidesModalsProps {
  selectedRide: RideWithDriver | null;
  selectedChatRide: SelectedChatRide | null;
  onCloseBooking: () => void;
  onBookingComplete: () => void;
  onCloseChat: () => void;
}

export function RidesModals({
  selectedRide,
  selectedChatRide,
  onCloseBooking,
  onBookingComplete,
  onCloseChat,
}: RidesModalsProps) {
  return (
    <>
      {selectedRide && (
        <BookingModal
          isOpen={!!selectedRide}
          onClose={onCloseBooking}
          ride={selectedRide}
          onBookingComplete={onBookingComplete}
        />
      )}

      {selectedChatRide && (
        <ChatDialog
          isOpen={!!selectedChatRide}
          onClose={onCloseChat}
          rideId={selectedChatRide.ride.id}
          conversationId={selectedChatRide.conversationId}
          otherUserId={selectedChatRide.ride.driver_id}
          otherUserName={selectedChatRide.ride.driver?.full_name || "Driver"}
          otherUserAvatar={selectedChatRide.ride.driver?.avatar_url}
        />
      )}
    </>
  );
}
