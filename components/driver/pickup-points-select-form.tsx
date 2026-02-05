"use client";

import { useState, useEffect } from "react";
import { Button, Input, Label, Card, CardContent, Checkbox } from "@/components/ui";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import type { CityPickupPoint, RidePickupPointInput } from "@/types";
import { format } from "date-fns";
import { useLocale } from "@/hooks";

interface PickupPointsSelectFormProps {
  cityPickupPoints: CityPickupPoint[];
  departureTime: Date | null;
  value: RidePickupPointInput[];
  onChange: (points: RidePickupPointInput[]) => void;
  error?: string;
  loading?: boolean;
}

export function PickupPointsSelectForm({
  cityPickupPoints,
  departureTime,
  value,
  onChange,
  error,
  loading,
}: PickupPointsSelectFormProps) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<RidePickupPointInput[]>(value?.length ? [...value] : []);

  useEffect(() => {
    setSelected(value?.length ? [...value] : []);
  }, [value]);

  const notify = (next: RidePickupPointInput[]) => {
    setSelected(next);
    onChange(next);
  };

  const togglePoint = (point: CityPickupPoint) => {
    const exists = selected.find((s) => s.id === point.id);
    if (exists) {
      const next = selected.filter((s) => s.id !== point.id).map((s, i) => ({ ...s, order: i + 1 }));
      notify(next);
    } else {
      const maxOffset = selected.length > 0 ? Math.max(...selected.map((s) => s.time_offset_minutes)) : -15;
      const next = [...selected, { id: point.id, order: selected.length + 1, time_offset_minutes: maxOffset + 15 }].map(
        (s, i) => ({ ...s, order: i + 1 })
      );
      notify(next);
    }
  };

  const move = (index: number, dir: "up" | "down") => {
    const next = [...selected];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    notify(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const setOffset = (id: string, time_offset_minutes: number) => {
    const next = selected.map((s) => (s.id === id ? { ...s, time_offset_minutes } : s));
    notify(next);
  };

  const remove = (id: string) => {
    const next = selected.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
    notify(next);
  };

  const selectedIds = new Set(selected.map((s) => s.id));
  const calculatePickupTime = (offsetMinutes: number): string | null => {
    if (!departureTime) return null;
    const t = new Date(departureTime.getTime() + offsetMinutes * 60 * 1000);
    return format(t, "h:mm a");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Label className="text-base font-semibold">{t("pages.driver.newRide.pickupPoints.title")}</Label>
        <p className="text-sm text-muted-foreground">{t("pages.driver.newRide.pickupPoints.selectLoading")}</p>
      </div>
    );
  }

  if (cityPickupPoints.length === 0) {
    return (
      <div className="space-y-4">
        <Label className="text-base font-semibold">{t("pages.driver.newRide.pickupPoints.title")}</Label>
        <p className="text-sm text-muted-foreground">{t("pages.driver.newRide.pickupPoints.noPointsForCity")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">{t("pages.driver.newRide.pickupPoints.title")}</Label>
        <p className="text-sm text-muted-foreground mt-1">{t("pages.driver.newRide.pickupPoints.selectDescription")}</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Label className="text-sm">{t("pages.driver.newRide.pickupPoints.available")}</Label>
        <div className="flex flex-wrap gap-3">
          {cityPickupPoints.map((point) => (
            <label key={point.id} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selectedIds.has(point.id)}
                onCheckedChange={() => togglePoint(point)}
              />
              <span className="text-sm">{point.name}</span>
            </label>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">
            {t("pages.driver.newRide.pickupPoints.selected")} ({selected.length})
          </Label>
          <div className="space-y-2">
            {selected.map((s, index) => {
              const cityPoint = cityPickupPoints.find((p) => p.id === s.id);
              const name = cityPoint?.name ?? s.id;
              const pickupTime = calculatePickupTime(s.time_offset_minutes);
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => move(index, "up")}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => move(index, "down")}
                        disabled={index === selected.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min={0}
                          step={5}
                          className="w-20"
                          value={s.time_offset_minutes}
                          onChange={(e) => setOffset(s.id, parseInt(e.target.value, 10) || 0)}
                        />
                        <span className="text-sm text-muted-foreground">{t("pages.driver.newRide.pickupPoints.minutes")}</span>
                        {pickupTime && (
                          <span className="text-xs text-muted-foreground">
                            {t("pages.driver.newRide.pickupPoints.pickupAt")} {pickupTime}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(s.id)}
                      disabled={selected.length <= 2}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {selected.length > 0 && selected.length < 2 && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          {t("pages.driver.newRide.pickupPoints.minRequired")}
        </p>
      )}
    </div>
  );
}
