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
  /** Points chosen by passengers who have already paid; cannot be removed */
  lockedPickupPointIds?: string[];
}

export function PickupPointsSelectForm({
  cityPickupPoints,
  departureTime,
  value,
  onChange,
  error,
  loading,
  lockedPickupPointIds,
}: PickupPointsSelectFormProps) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<RidePickupPointInput[]>(value?.length ? [...value] : []);
  const lockedSet = new Set(lockedPickupPointIds ?? []);

  useEffect(() => {
    setSelected(value?.length ? [...value] : []);
  }, [value]);

  const notify = (next: RidePickupPointInput[]) => {
    const normalized =
      next.length > 0
        ? next.map((p, i) => (i === 0 ? { ...p, time_offset_minutes: 0 } : p))
        : next;
    setSelected(normalized);
    onChange(normalized);
  };

  const togglePoint = (point: CityPickupPoint) => {
    const exists = selected.find((s) => s.id === point.id);
    if (exists) {
      if (lockedSet.has(point.id)) return;
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
    if (lockedSet.has(id)) return;
    const next = selected.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
    notify(next);
  };

  const selectedIds = new Set(selected.map((s) => s.id));
  const calculatePickupTime = (offsetMinutes: number): string | null => {
    if (!departureTime) return null;
    const t = new Date(departureTime.getTime() + offsetMinutes * 60 * 1000);
    return format(t, "h:mm a");
  };

  const offsetToTimeString = (offsetMinutes: number): string => {
    if (!departureTime) return "00:00";
    const t = new Date(departureTime.getTime() + offsetMinutes * 60 * 1000);
    return format(t, "HH:mm");
  };

  const timeStringToOffset = (timeStr: string): number => {
    if (!departureTime || !timeStr) return 0;
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    const d = new Date(departureTime);
    d.setHours(hours, minutes, 0, 0);
    const offsetMs = d.getTime() - departureTime.getTime();
    return Math.max(0, Math.round(offsetMs / 60000));
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
          {cityPickupPoints.map((point) => {
            const isLocked = lockedSet.has(point.id);
            const isSelected = selectedIds.has(point.id);
            return (
              <label
                key={point.id}
                className={`flex items-center gap-2 ${isLocked && isSelected ? "cursor-default" : "cursor-pointer"}`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => togglePoint(point)}
                  disabled={isLocked && isSelected}
                />
                <span className="text-sm">{point.name}</span>
                {isLocked && isSelected && (
                  <span className="text-xs text-muted-foreground">
                    ({t("pages.driver.manageRide.pickupPoints.requiredForPaidPassenger")})
                  </span>
                )}
              </label>
            );
          })}
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
              const isFirst = index === 0;
              const pickupTime = isFirst && departureTime
                ? format(departureTime, "h:mm a")
                : calculatePickupTime(s.time_offset_minutes);
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
                      {lockedSet.has(s.id) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("pages.driver.manageRide.pickupPoints.requiredForPaidPassenger")}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {index === 0 ? (
                          <>
                            <span className="text-sm text-muted-foreground">
                              {t("pages.driver.newRide.pickupPoints.firstPointDeparture")}
                            </span>
                            {pickupTime && (
                              <span className="text-xs text-muted-foreground">
                                {t("pages.driver.newRide.pickupPoints.pickupAt")} {pickupTime}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <Label className="sr-only">{t("pages.driver.newRide.pickupPoints.exactTimeAtPoint")}</Label>
                            <Input
                              type="time"
                              className="w-32"
                              value={offsetToTimeString(s.time_offset_minutes)}
                              onChange={(e) => setOffset(s.id, timeStringToOffset(e.target.value))}
                            />
                            {pickupTime && (
                              <span className="text-xs text-muted-foreground">
                                {t("pages.driver.newRide.pickupPoints.pickupAt")} {pickupTime}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(s.id)}
                      disabled={selected.length <= 1 || lockedSet.has(s.id)}
                      className="flex-shrink-0"
                      title={lockedSet.has(s.id) ? t("pages.driver.manageRide.pickupPoints.requiredForPaidPassenger") : undefined}
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

    </div>
  );
}
