import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { RidePreview } from "@/types/driver";

interface DriverRecentRidesProps {
  rides: RidePreview[];
  driverId: string;
}

export function DriverRecentRides({ rides, driverId }: DriverRecentRidesProps) {
  if (!rides || rides.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trajets récents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rides.slice(0, 5).map((ride) => (
            <Link
              key={ride.id}
              href={`/rides?driver_id=${driverId}`}
              className="block"
            >
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">
                      {ride.from_city}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      {ride.to_city}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {format(
                          new Date(ride.departure_time),
                          "dd MMM yyyy à HH:mm"
                        )}
                      </span>
                    </div>
                    <span className="font-semibold text-primary">
                      {ride.price.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t">
          <Link href={`/rides?driver_id=${driverId}`}>
            <Button variant="outline" className="w-full">
              Voir tous les trajets de ce conducteur
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

