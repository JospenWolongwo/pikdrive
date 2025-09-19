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
