"use client";

import { BookingModal } from "@/app/rides/booking-modal";
import { ChatDialog, PendingSyncBadge } from "@/components";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { useLocale } from "@/hooks";
import { formatDate } from "@/lib/utils";

import type { BookingWithPayments } from "@/types";

import { BookingCardActions } from "./booking-card-actions";
import { BookingCardDetails } from "./booking-card-details";
import { ReduceSeatsDialog } from "./reduce-seats-dialog";
import { useBookingCard } from "./use-booking-card";

interface BookingCardProps {
  booking: BookingWithPayments;
}

export function BookingCard({ booking }: BookingCardProps) {
  const { t } = useLocale();
  const {
    payment,
    isCompleted,
    showVerification,
    toggleVerification,
    isCancelling,
    codeVerified,
    selectedChatRide,
    closeChat,
    showReduceSeatsDialog,
    openReduceSeatsDialog,
    closeReduceSeatsDialog,
    showAddSeatsDialog,
    openAddSeatsDialog,
    closeAddSeatsDialog,
    newSeats,
    setNewSeats,
    isReducingSeats,
    displayStatus,
    isNoShow,
    cutoffLabel,
    travelStartLabel,
    shouldShowVerification,
    canCancel,
    canReduceSeats,
    canAddSeats,
    showCutoffHint,
    showLateWindowHint,
    handleCancelBooking,
    handleReduceSeats,
    handleOpenChat,
    handleAddSeatsComplete,
  } = useBookingCard(booking);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {booking.ride.from_city} {"\u2192"} {booking.ride.to_city}
          <span className="ml-2">
            <PendingSyncBadge rideId={booking.ride.id} />
          </span>
        </CardTitle>
        <CardDescription>{formatDate(booking.ride.departure_time)}</CardDescription>
      </CardHeader>

      <BookingCardDetails
        booking={booking}
        payment={payment}
        isCompleted={isCompleted}
        displayStatus={displayStatus}
        isNoShow={isNoShow}
        showCutoffHint={showCutoffHint}
        cutoffLabel={cutoffLabel}
        showLateWindowHint={showLateWindowHint}
        travelStartLabel={travelStartLabel}
        shouldShowVerification={shouldShowVerification}
        showVerification={showVerification}
        onToggleVerification={toggleVerification}
      />

      <BookingCardActions
        booking={booking}
        isNoShow={isNoShow}
        codeVerified={codeVerified}
        canAddSeats={canAddSeats}
        canReduceSeats={canReduceSeats}
        canCancel={canCancel}
        isCancelling={isCancelling}
        onOpenChat={handleOpenChat}
        onOpenAddSeats={openAddSeatsDialog}
        onOpenReduceSeats={openReduceSeatsDialog}
        onCancelBooking={handleCancelBooking}
      />

      <ReduceSeatsDialog
        open={showReduceSeatsDialog}
        onOpenChange={(open) => {
          if (open) {
            openReduceSeatsDialog();
          } else {
            closeReduceSeatsDialog();
          }
        }}
        currentSeats={booking.seats}
        ridePrice={booking.ride.price}
        paymentPhoneNumber={payment?.phone_number}
        newSeats={newSeats}
        onNewSeatsChange={setNewSeats}
        isReducingSeats={isReducingSeats}
        onConfirm={handleReduceSeats}
      />

      <BookingModal
        isOpen={showAddSeatsDialog}
        onClose={closeAddSeatsDialog}
        ride={booking.ride}
        onBookingComplete={handleAddSeatsComplete}
      />

      {selectedChatRide && (
        <ChatDialog
          isOpen={!!selectedChatRide}
          onClose={closeChat}
          rideId={selectedChatRide.ride.id}
          conversationId={selectedChatRide.conversationId}
          otherUserId={selectedChatRide.ride.driver_id}
          otherUserName={
            selectedChatRide.ride.driver?.full_name ||
            t("pages.bookings.card.driver").replace(":", "")
          }
          otherUserAvatar={selectedChatRide.ride.driver?.avatar_url}
        />
      )}
    </Card>
  );
}
