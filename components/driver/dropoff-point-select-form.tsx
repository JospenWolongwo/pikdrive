"use client";

import { Label, SearchableSelect } from "@/components/ui";
import type { CityPickupPoint } from "@/types";
import { useLocale } from "@/hooks";

interface DropoffPointSelectFormProps {
  cityDropoffPoints: CityPickupPoint[];
  value?: string;
  onChange: (dropoffPointId: string) => void;
  error?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function DropoffPointSelectForm({
  cityDropoffPoints,
  value,
  onChange,
  error,
  loading,
  disabled,
}: DropoffPointSelectFormProps) {
  const { t } = useLocale();
  const selectedPoint = cityDropoffPoints.find((point) => point.id === value);
  const options = cityDropoffPoints.map((point) => point.name).sort();

  const handleNameChange = (selectedName: string) => {
    const selected = cityDropoffPoints.find((point) => point.name === selectedName);
    onChange(selected?.id || "");
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {t("pages.rides.rideCard.destinationPoint")}
      </Label>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          {t("pages.driver.newRide.pickupPoints.selectLoading")}
        </p>
      ) : cityDropoffPoints.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("pages.driver.newRide.pickupPoints.noPointsForCity")}
        </p>
      ) : (
        <SearchableSelect
          options={options}
          value={selectedPoint?.name}
          onValueChange={handleNameChange}
          placeholder={t("pages.driver.newRide.toCityPlaceholder")}
          searchPlaceholder={t("pages.rides.filters.toSearch")}
          disabled={disabled}
        />
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
