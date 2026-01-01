import { useState, useCallback } from "react";

export interface RideFilters {
  fromCity: string | null;
  toCity: string | null;
  minPrice: number;
  maxPrice: number;
  minSeats: number;
}

interface UseRideFiltersReturn {
  filters: RideFilters;
  tempFilters: RideFilters;
  showFilters: boolean;
  setTempFilters: {
    setFromCity: (city: string | null) => void;
    setToCity: (city: string | null) => void;
    setMinPrice: (price: number) => void;
    setMaxPrice: (price: number) => void;
    setMinSeats: (seats: number) => void;
  };
  handleSearch: () => void;
  handleClear: () => void;
  toggleFilters: () => void;
  applyFilters: (filters: Partial<RideFilters>) => void;
}

const DEFAULT_FILTERS: RideFilters = {
  fromCity: null,
  toCity: null,
  minPrice: 0,
  maxPrice: 20000,
  minSeats: 1,
};

export function useRideFilters(
  onSearch: (filters: RideFilters) => void,
  onPageChange?: () => void
): UseRideFiltersReturn {
  const [filters, setFilters] = useState<RideFilters>(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] = useState<RideFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = useCallback(() => {
    setFilters(tempFilters);
    if (onPageChange) {
      onPageChange(); // Reset to first page when searching
    }
    onSearch(tempFilters);
  }, [tempFilters, onSearch, onPageChange]);

  const handleClear = useCallback(() => {
    setTempFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    if (onPageChange) {
      onPageChange();
    }
    onSearch(DEFAULT_FILTERS);
  }, [onSearch, onPageChange]);

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const applyFilters = useCallback(
    (newFilters: Partial<RideFilters>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      setTempFilters((prev) => ({ ...prev, ...newFilters }));
      onSearch({ ...filters, ...newFilters });
    },
    [filters, onSearch]
  );

  return {
    filters,
    tempFilters,
    showFilters,
    setTempFilters: {
      setFromCity: (city: string | null) =>
        setTempFilters((prev) => ({ ...prev, fromCity: city === "" ? null : city })),
      setToCity: (city: string | null) =>
        setTempFilters((prev) => ({ ...prev, toCity: city === "" ? null : city })),
      setMinPrice: (price: number) =>
        setTempFilters((prev) => ({ ...prev, minPrice: price })),
      setMaxPrice: (price: number) =>
        setTempFilters((prev) => ({ ...prev, maxPrice: price })),
      setMinSeats: (seats: number) =>
        setTempFilters((prev) => ({ ...prev, minSeats: seats })),
    },
    handleSearch,
    handleClear,
    toggleFilters,
    applyFilters,
  };
}

