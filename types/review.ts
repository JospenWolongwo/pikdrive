/**
 * Review System Types
 * 
 * Two-way review system allowing passengers and drivers to review each other
 * after verified ride completion
 */

export type ReviewerType = 'passenger' | 'driver';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

/**
 * Review tags for categorized feedback
 */
export const REVIEW_TAGS = {
  // Driver tags (from passengers)
  PUNCTUAL: 'punctual',
  FRIENDLY: 'friendly',
  CLEAN_CAR: 'clean_car',
  SAFE_DRIVER: 'safe_driver',
  PROFESSIONAL: 'professional',
  
  // Passenger tags (from drivers)
  RESPECTFUL: 'respectful',
  ON_TIME: 'on_time',
  GOOD_COMMUNICATION: 'good_communication',
  PLEASANT: 'pleasant',
} as const;

export type ReviewTag = typeof REVIEW_TAGS[keyof typeof REVIEW_TAGS];

/**
 * Base review interface
 */
export interface Review {
  readonly id: string;
  readonly booking_id: string;
  readonly ride_id: string;
  readonly reviewer_id: string;
  readonly reviewer_type: ReviewerType;
  readonly reviewee_id: string;
  readonly reviewee_type: ReviewerType;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly comment?: string;
  readonly tags?: readonly string[];
  readonly is_public: boolean;
  readonly is_verified: boolean;
  readonly is_flagged: boolean;
  readonly moderation_status: ModerationStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * Review with profile information
 */
export interface ReviewWithProfiles extends Review {
  readonly reviewer: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
  };
  readonly reviewee: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
  };
  readonly ride: {
    readonly from_city: string;
    readonly to_city: string;
    readonly departure_time: string;
  };
}

/**
 * Create review request payload
 */
export interface CreateReviewRequest {
  readonly booking_id: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly comment?: string;
  readonly tags?: readonly string[];
}

/**
 * Review statistics for a user
 */
export interface ReviewStatistics {
  readonly average_rating: number;
  readonly total_reviews: number;
  readonly rating_distribution: {
    readonly 5: number;
    readonly 4: number;
    readonly 3: number;
    readonly 2: number;
    readonly 1: number;
  };
}

/**
 * Review eligibility check response
 */
export interface ReviewEligibility {
  readonly canReview: boolean;
  readonly reason?: string;
  readonly booking?: {
    readonly id: string;
    readonly ride_id: string;
    readonly reviewee_id: string;
    readonly reviewee_name: string;
    readonly reviewee_type: ReviewerType;
    readonly route: string;
    readonly departure_time: string;
  };
  readonly existingReview?: Review;
}

/**
 * Review list options for filtering and pagination
 */
export interface ReviewListOptions {
  readonly reviewee_id?: string;
  readonly reviewer_id?: string;
  readonly rating?: 1 | 2 | 3 | 4 | 5;
  readonly limit?: number;
  readonly offset?: number;
  readonly include_profiles?: boolean;
}
