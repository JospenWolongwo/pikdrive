import { useState, useEffect } from 'react';
import { getPickupPointsByCity } from '@/lib/api-client';
import type { CityPickupPoint } from '@/types';

/**
 * Fetches city pickup points when city changes. Cancels in-flight requests on unmount or city change.
 */
export function useCityPickupPoints(city: string): {
  cityPickupPoints: CityPickupPoint[];
  loading: boolean;
} {
  const [cityPickupPoints, setCityPickupPoints] = useState<CityPickupPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city || city.trim() === '') {
      setCityPickupPoints([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPickupPointsByCity(city)
      .then((data) => {
        if (!cancelled) setCityPickupPoints(data);
      })
      .catch(() => {
        if (!cancelled) setCityPickupPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city]);

  return { cityPickupPoints, loading };
}
