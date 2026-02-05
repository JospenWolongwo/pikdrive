import { Button, Input, Label, SearchableSelect } from "@/components/ui";
import { Search, Filter } from "lucide-react";
import { allCameroonCities } from "@/app/data/cities";
import type { RideFilters } from "@/hooks/passenger/use-ride-filters";
import { useLocale } from "@/hooks";

interface RideFiltersProps {
  tempFilters: RideFilters;
  showFilters: boolean;
  onFilterChange: {
    setFromCity: (city: string | null) => void;
    setToCity: (city: string | null) => void;
    setMinPrice: (price: number) => void;
    setMaxPrice: (price: number) => void;
    setMinSeats: (seats: number) => void;
  };
  onClearCityFilter: {
    clearFromCity: () => void;
    clearToCity: () => void;
  };
  onSearch: () => void;
  onClear: () => void;
  onToggleFilters: () => void;
}

export function RideFiltersComponent({
  tempFilters,
  showFilters,
  onFilterChange,
  onClearCityFilter,
  onSearch,
  onClear,
  onToggleFilters,
}: RideFiltersProps) {
  const { t } = useLocale();
  return (
    <div className="space-y-4">
      {/* Main search row */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Departure city */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="from-city" className="text-sm font-medium">
            {t("pages.rides.filters.from")}
          </Label>
          <SearchableSelect
            options={allCameroonCities}
            value={tempFilters.fromCity || ""}
            onValueChange={onFilterChange.setFromCity}
            onClearWithApply={onClearCityFilter.clearFromCity}
            placeholder={t("pages.rides.filters.fromPlaceholder")}
            searchPlaceholder={t("pages.rides.filters.fromSearch")}
          />
        </div>

        {/* Destination city */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="to-city" className="text-sm font-medium">
            {t("pages.rides.filters.to")}
          </Label>
          <SearchableSelect
            options={allCameroonCities}
            value={tempFilters.toCity || ""}
            onValueChange={onFilterChange.setToCity}
            onClearWithApply={onClearCityFilter.clearToCity}
            placeholder={t("pages.rides.filters.toPlaceholder")}
            searchPlaceholder={t("pages.rides.filters.toSearch")}
          />
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onSearch}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          <Search className="h-4 w-4 mr-2" />
          {t("pages.rides.filters.search")}
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleFilters}
            className={showFilters ? "bg-secondary" : ""}
          >
            <Filter className="h-4 w-4" />
          </Button>

          <Button variant="outline" onClick={onClear} className="hover:bg-secondary">
            {t("pages.rides.filters.clear")}
          </Button>
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("pages.rides.filters.priceRange")}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={tempFilters.minPrice}
                onChange={(e) =>
                  onFilterChange.setMinPrice(Number(e.target.value))
                }
                className="flex-1"
                min={0}
                max={tempFilters.maxPrice}
                placeholder={t("pages.rides.filters.minPrice")}
              />
              <span className="text-muted-foreground">{t("pages.rides.filters.to")}</span>
              <Input
                type="number"
                value={tempFilters.maxPrice}
                onChange={(e) =>
                  onFilterChange.setMaxPrice(Number(e.target.value))
                }
                className="flex-1"
                min={tempFilters.minPrice}
                max={20000}
                placeholder={t("pages.rides.filters.maxPrice")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("pages.rides.filters.minSeats")}</Label>
            <Input
              type="number"
              value={tempFilters.minSeats}
              onChange={(e) =>
                onFilterChange.setMinSeats(
                  Math.max(1, Math.min(4, Number(e.target.value)))
                )
              }
              min={1}
              max={4}
              className="w-full max-w-[120px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

