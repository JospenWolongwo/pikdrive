import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Search, Filter } from "lucide-react";
import { allCameroonCities } from "@/app/data/cities";
import type { RideFilters } from "@/hooks/passenger/use-ride-filters";

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
  return (
    <div className="space-y-4">
      {/* Main search row */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Departure city */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="from-city" className="text-sm font-medium">
            De
          </Label>
          <SearchableSelect
            options={allCameroonCities}
            value={tempFilters.fromCity || ""}
            onValueChange={onFilterChange.setFromCity}
            onClearWithApply={onClearCityFilter.clearFromCity}
            placeholder="Sélectionnez la ville de départ"
            searchPlaceholder="Rechercher une ville de départ..."
          />
        </div>

        {/* Destination city */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="to-city" className="text-sm font-medium">
            À
          </Label>
          <SearchableSelect
            options={allCameroonCities}
            value={tempFilters.toCity || ""}
            onValueChange={onFilterChange.setToCity}
            onClearWithApply={onClearCityFilter.clearToCity}
            placeholder="Sélectionnez la ville de destination"
            searchPlaceholder="Rechercher une ville de destination..."
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
          Rechercher
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
            Effacer
          </Button>
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Fourchette de Prix (FCFA)
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
                placeholder="Min"
              />
              <span className="text-muted-foreground">à</span>
              <Input
                type="number"
                value={tempFilters.maxPrice}
                onChange={(e) =>
                  onFilterChange.setMaxPrice(Number(e.target.value))
                }
                className="flex-1"
                min={tempFilters.minPrice}
                max={20000}
                placeholder="Max"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Places Minimum</Label>
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

