import type { Ride } from './ride';
import type { UserProfile } from './user';

export interface Driver {
  readonly id: string;
  readonly user_id: string;
  readonly license_number: string;
  readonly license_expiry: string;
  readonly vehicle_registration: string;
  readonly insurance_number: string;
  readonly status: DriverStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

export type DriverStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'active';

export interface DriverProfile extends Driver {
  readonly user: UserProfile;
  readonly rides?: Ride[];
}

export interface DriverApplication {
  readonly id: string;
  readonly user_id: string;
  readonly license_number: string;
  readonly license_expiry: string;
  readonly vehicle_registration: string;
  readonly insurance_number: string;
  readonly vehicle_images?: string[];
  readonly status: DriverStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateDriverApplicationRequest {
  readonly license_number: string;
  readonly license_expiry: string;
  readonly vehicle_registration: string;
  readonly insurance_number: string;
  readonly vehicle_images?: string[];
}

export interface UpdateDriverStatusRequest {
  readonly status: DriverStatus;
  readonly reason?: string;
}

export interface RidePreview {
  readonly id: string;
  readonly from_city: string;
  readonly to_city: string;
  readonly departure_time: string;
  readonly price: number;
}

export interface DriverPublicProfile {
  readonly id: string;
  readonly full_name: string;
  readonly avatar_url: string | null;
  readonly city: string | null;
  readonly driver_status: string;
  readonly created_at: string;
  readonly vehicle_images: string[];
  readonly verification_status: string;
  readonly statistics: {
    readonly totalTrips: number;
    readonly totalPassengers: number;
    readonly memberSince: string;
  };
  readonly recentRides?: RidePreview[];
}
