import { apiClient } from './index';
import type { CityPickupPoint } from '@/types';

export interface AdminApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class AdminApiClient {
  async getPickupPoints(city?: string): Promise<AdminApiResponse<CityPickupPoint[]>> {
    const query = city ? `?city=${encodeURIComponent(city)}` : '';
    return apiClient.get<AdminApiResponse<CityPickupPoint[]>>(
      `/api/admin/pickup-points${query}`
    );
  }

  async createPickupPoint(params: {
    city: string;
    name: string;
    display_order: number;
  }): Promise<AdminApiResponse<CityPickupPoint>> {
    return apiClient.post<AdminApiResponse<CityPickupPoint>>(
      '/api/admin/pickup-points',
      params
    );
  }

  async updatePickupPoint(
    id: string,
    params: { name?: string; display_order?: number }
  ): Promise<AdminApiResponse<CityPickupPoint>> {
    return apiClient.patch<AdminApiResponse<CityPickupPoint>>(
      `/api/admin/pickup-points/${id}`,
      params
    );
  }

  async deletePickupPoint(id: string): Promise<AdminApiResponse<void>> {
    return apiClient.delete<AdminApiResponse<void>>(
      `/api/admin/pickup-points/${id}`
    );
  }

  async getPassengers<T = any>(): Promise<AdminApiResponse<T[]>> {
    return apiClient.get<AdminApiResponse<T[]>>('/api/admin/passengers');
  }

  async updateDriverStatus(
    driverId: string,
    status: string
  ): Promise<AdminApiResponse<void>> {
    return apiClient.patch<AdminApiResponse<void>>(
      `/api/admin/drivers/${driverId}/status`,
      { status }
    );
  }
}

export const adminApiClient = new AdminApiClient();
