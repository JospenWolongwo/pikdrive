import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import type { RideBooking, TranslateFn } from "../types";

interface RideBookingsCardProps {
  t: TranslateFn;
  hasBookings: boolean;
  bookings?: RideBooking[];
  markingNoShowId: string | null;
  onOpenNoShowDialog: (bookingId: string) => void;
  onViewBooking: (bookingId: string) => void;
}

export function RideBookingsCard({
  t,
  hasBookings,
  bookings,
  markingNoShowId,
  onOpenNoShowDialog,
  onViewBooking,
}: RideBookingsCardProps) {
  if (!hasBookings) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.driver.manageRide.bookings.title")}</CardTitle>
        <CardDescription>
          {t("pages.driver.manageRide.bookings.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bookings?.map((booking) => {
            const isBookingNoShow = Boolean(booking.no_show_marked_at);
            const canMarkNoShow = Boolean(booking.policy?.canDriverMarkNoShow);
            const passengerName =
              booking.user?.full_name || booking.user_id || booking.id.slice(0, 8);

            return (
              <div key={booking.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{passengerName}</p>
                    <p className="font-medium">
                      {t("pages.driver.manageRide.bookings.bookingId", {
                        id: booking.id.slice(0, 8),
                      })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isBookingNoShow
                        ? t("pages.driver.manageRide.bookings.noShowRecorded")
                        : t("pages.driver.manageRide.bookings.status", {
                            status: booking.status,
                          })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {canMarkNoShow ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={markingNoShowId === booking.id}
                        onClick={() => onOpenNoShowDialog(booking.id)}
                      >
                        {markingNoShowId === booking.id
                          ? t("pages.driver.manageRide.bookings.confirmingNoShow")
                          : t("pages.driver.manageRide.bookings.markNoShow")}
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewBooking(booking.id)}
                    >
                      {t("pages.driver.manageRide.bookings.viewDetails")}
                    </Button>
                  </div>
                </div>
                {isBookingNoShow ? (
                  <p className="mt-3 text-sm text-amber-700">
                    {t("pages.driver.manageRide.bookings.noShowHelp")}
                  </p>
                ) : null}
              </div>
            );
          }) || (
            <p className="text-gray-500 text-center py-4">
              {t("pages.driver.manageRide.bookings.noBookings")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
