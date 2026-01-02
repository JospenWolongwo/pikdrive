import { useState, useCallback, useRef, useEffect } from "react";

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
  clearAndApplyCityFilter: {
    clearFromCity: () => void;
    clearToCity: () => void;
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
  
  // Use ref to track current tempFilters for immediate access in clear functions
  // This ensures we always work with the latest state, avoiding React batching issues
  const tempFiltersRef = useRef<RideFilters>(DEFAULT_FILTERS);
  
  // Keep ref in sync with state
  useEffect(() => {
    tempFiltersRef.current = tempFilters;
  }, [tempFilters]);

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

  const clearFromCity = useCallback(() => {
    // Use ref to get the latest state immediately (avoiding React batching issues)
    const currentFilters = tempFiltersRef.current;
    const newFilters = { ...currentFilters, fromCity: null };
    
    // Update both state values
    setTempFilters(newFilters);
    setFilters(newFilters);
    
    // Trigger page change if needed
    if (onPageChange) {
      onPageChange();
    }
    
    // Trigger search with the new filters
    onSearch(newFilters);
  }, [onSearch, onPageChange]);

  const clearToCity = useCallback(() => {
    // Use ref to get the latest state immediately (avoiding React batching issues)
    const currentFilters = tempFiltersRef.current;
    const newFilters = { ...currentFilters, toCity: null };
    
    // Update both state values
    setTempFilters(newFilters);
    setFilters(newFilters);
    
    // Trigger page change if needed
    if (onPageChange) {
      onPageChange();
    }
    
    // Trigger search with the new filters
    onSearch(newFilters);
  }, [onSearch, onPageChange]);

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
    clearAndApplyCityFilter: {
      clearFromCity,
      clearToCity,
    },
    handleSearch,
    handleClear,
    toggleFilters,
    applyFilters,
  };
}

