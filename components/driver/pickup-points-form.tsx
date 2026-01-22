"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { PickupPoint } from "@/types";
import { format } from "date-fns";
import { useLocale } from "@/hooks";

interface PickupPointsFormProps {
  departureTime: Date | null;
  value: PickupPoint[];
  onChange: (points: PickupPoint[]) => void;
  error?: string;
}

export function PickupPointsForm({
  departureTime,
  value,
  onChange,
  error,
}: PickupPointsFormProps) {
  const { t } = useLocale();
  const [points, setPoints] = useState<PickupPoint[]>(value || []);

  // Sync with parent value
  useEffect(() => {
    setPoints(value || []);
  }, [value]);

  // Update parent when points change
  const updatePoints = (newPoints: PickupPoint[]) => {
    setPoints(newPoints);
    onChange(newPoints);
  };

  const addPoint = () => {
    const newPoint: PickupPoint = {
      id: crypto.randomUUID(),
      name: "",
      order: points.length + 1,
      time_offset_minutes: points.length > 0 
        ? Math.max(...points.map(p => p.time_offset_minutes)) + 15 
        : 0,
    };
    updatePoints([...points, newPoint]);
  };

  const removePoint = (id: string) => {
    if (points.length <= 2) return; // Prevent removing if only 2 left
    const filtered = points.filter(p => p.id !== id);
    // Reassign orders
    const reordered = filtered.map((p, index) => ({
      ...p,
      order: index + 1,
    }));
    updatePoints(reordered);
  };

  const updatePoint = (id: string, field: keyof PickupPoint, newValue: string | number) => {
    const updated = points.map(p => {
      if (p.id === id) {
        return { ...p, [field]: newValue };
      }
      return p;
    });
    updatePoints(updated);
  };

  const calculatePickupTime = (offsetMinutes: number): string | null => {
    if (!departureTime) return null;
    const pickupTime = new Date(departureTime.getTime() + offsetMinutes * 60 * 1000);
    return format(pickupTime, "h:mm a");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">
            {t("pages.driver.newRide.pickupPoints.title")}
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            {t("pages.driver.newRide.pickupPoints.description")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPoint}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("pages.driver.newRide.pickupPoints.add")}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-3">
        {points.map((point, index) => {
          const pickupTime = calculatePickupTime(point.time_offset_minutes);
          const canRemove = points.length > 2;

          return (
            <Card key={point.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Order indicator */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm mt-1 flex-shrink-0">
                    {point.order}
                  </div>

                  {/* Form fields */}
                  <div className="flex-1 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`pickup-name-${point.id}`}>
                        {t("pages.driver.newRide.pickupPoints.name")}
                      </Label>
                      <Input
                        id={`pickup-name-${point.id}`}
                        placeholder={t("pages.driver.newRide.pickupPoints.namePlaceholder")}
                        value={point.name}
                        onChange={(e) => updatePoint(point.id, "name", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`pickup-time-${point.id}`}>
                        {t("pages.driver.newRide.pickupPoints.timeOffset")}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`pickup-time-${point.id}`}
                          type="number"
                          min="0"
                          step="5"
                          placeholder="0"
                          value={point.time_offset_minutes}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updatePoint(point.id, "time_offset_minutes", val);
                          }}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {t("pages.driver.newRide.pickupPoints.minutes")}
                        </span>
                      </div>
                      {pickupTime && (
                        <p className="text-xs text-muted-foreground">
                          {t("pages.driver.newRide.pickupPoints.pickupAt")} {pickupTime}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePoint(point.id)}
                    disabled={!canRemove}
                    className="flex-shrink-0 mt-1"
                    title={canRemove ? t("pages.driver.newRide.pickupPoints.remove") : t("pages.driver.newRide.pickupPoints.minRequired")}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {points.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>{t("pages.driver.newRide.pickupPoints.noPoints")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={addPoint}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("pages.driver.newRide.pickupPoints.addFirst")}
          </Button>
        </div>
      )}

      {points.length > 0 && points.length < 2 && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          {t("pages.driver.newRide.pickupPoints.minRequired")}
        </p>
      )}
    </div>
  );
}
