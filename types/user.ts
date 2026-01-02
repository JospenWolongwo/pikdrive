export interface UserProfile {
  readonly id: string;
  readonly full_name: string;
  readonly avatar_url?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface User {
  readonly id: string;
  readonly email?: string;
  readonly phone?: string;
  readonly user_metadata?: Record<string, any>;
  readonly app_metadata?: Record<string, any>;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateUserProfileRequest {
  readonly full_name: string;
  readonly avatar_url?: string;
  readonly phone?: string;
  readonly email?: string;
}

export interface UpdateUserProfileRequest {
  readonly full_name?: string;
  readonly avatar_url?: string;
  readonly phone?: string;
  readonly email?: string;
}

export interface ProfileData {
  readonly full_name: string;
  readonly email: string;
  readonly phone: string;
  readonly city: string;
  readonly avatar_url: string | null;
  readonly is_driver: boolean;
  readonly driver_status: string;
  readonly role: string;
  readonly driver_application_status: string;
  readonly driver_application_date: string | null;
  readonly is_driver_applicant: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DriverDocuments {
  readonly vehicle_images: string[] | null;
  readonly status: string;
  readonly created_at: string;
  readonly national_id_file_recto: string | null;
  readonly national_id_file_verso: string | null;
  readonly license_file_recto: string | null;
  readonly license_file_verso: string | null;
  readonly registration_file_recto: string | null;
  readonly registration_file_verso: string | null;
  readonly insurance_file_recto: string | null;
  readonly insurance_file_verso: string | null;
}
