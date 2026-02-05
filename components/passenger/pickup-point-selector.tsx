"use client";

import { useState } from "react";
import { Card, CardContent, Label } from "@/components/ui";
import { MapPin, Clock } from "lucide-react";
import type { PickupPoint } from "@/types";
import { format } from "date-fns";
import { useLocale } from "@/hooks";
import { cn } from "@/lib/utils";

interface PickupPointSelectorProps {
  pickupPoints: readonly PickupPoint[];
  departureTime: string;
  value?: string; // selected_pickup_point_id
  onChange: (pickupPointId: string) => void;
  error?: string;
}

export function PickupPointSelector({
  pickupPoints,
  departureTime,
  value,
  onChange,
  error,
}: PickupPointSelectorProps) {
  const { t } = useLocale();

  if (!pickupPoints || pickupPoints.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p>{t("pages.rides.booking.pickupPoint.noPoints")}</p>
      </div>
    );
  }

  const calculatePickupTime = (offsetMinutes: number): string => {
    const departure = new Date(departureTime);
    const pickupTime = new Date(departure.getTime() + offsetMinutes * 60 * 1000);
    return format(pickupTime, "h:mm a");
  };

  // Sort points by order
  const sortedPoints = [...pickupPoints].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">
        {t("pages.rides.booking.pickupPoint.title")}
      </Label>
      <p className="text-sm text-muted-foreground">
        {t("pages.rides.booking.pickupPoint.description")}
      </p>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        {sortedPoints.map((point) => {
          const pickupTime = calculatePickupTime(point.time_offset_minutes);
          const isSelected = value === point.id;

          return (
            <Card
              key={point.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                isSelected && "border-primary bg-primary/5"
              )}
              onClick={() => onChange(point.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Order badge */}
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm flex-shrink-0",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {point.order}
                  </div>

                  {/* Point details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                      <h4 className="font-medium text-sm">{point.name}</h4>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{t("pages.rides.booking.pickupPoint.pickupAt")} {pickupTime}</span>
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
