import { apiClient } from './index';
import type { CityPickupPoint } from '@/types';

interface PickupPointsResponse {
  success: boolean;
  data?: CityPickupPoint[];
  error?: string;
}

/**
 * Fetch pickup points for a city (for driver ride create/edit).
 * Returns [] when city is empty or on API/network error.
 */
export async function getPickupPointsByCity(
  city: string
): Promise<CityPickupPoint[]> {
  const trimmed = city?.trim() ?? '';
  if (trimmed === '') {
    return [];
  }
  try {
    const res = await apiClient.get<PickupPointsResponse>(
      `/api/pickup-points?city=${encodeURIComponent(trimmed)}`
    );
    if (res.success && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  } catch {
    return [];
  }
}
