import { format } from "date-fns";
import { X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CancelledBooking } from "@/types";

interface CancellationNotificationsProps {
  cancelledBookings: CancelledBooking[];
}

export function CancellationNotifications({
  cancelledBookings,
}: CancellationNotificationsProps) {
  if (cancelledBookings.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <X className="h-5 w-5" />
          Annulations récentes
        </CardTitle>
        <CardDescription className="text-orange-700">
          {cancelledBookings.length} réservation
          {cancelledBookings.length > 1 ? "s" : ""} annulée
          {cancelledBookings.length > 1 ? "s" : ""} dans les dernières 24h
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {cancelledBookings.slice(0, 3).map((cancelled) => (
            <div
              key={cancelled.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-white rounded-lg border border-orange-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-orange-900 text-sm sm:text-base">
                    {cancelled.passengerName} a annulé sa réservation
                  </p>
                  <p className="text-xs sm:text-sm text-orange-700 truncate">
                    {cancelled.rideRoute} • {cancelled.seats} place
                    {cancelled.seats > 1 ? "s" : ""} libérée
                    {cancelled.seats > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <span className="text-xs text-orange-600 self-end sm:self-auto">
                {format(new Date(cancelled.cancelledAt), "HH:mm")}
              </span>
            </div>
          ))}
          {cancelledBookings.length > 3 && (
            <p className="text-sm text-orange-600 text-center">
              Et {cancelledBookings.length - 3} autre
              {cancelledBookings.length - 3 > 1 ? "s" : ""} annulation
              {cancelledBookings.length - 3 > 1 ? "s" : ""}...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
