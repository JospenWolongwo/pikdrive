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
