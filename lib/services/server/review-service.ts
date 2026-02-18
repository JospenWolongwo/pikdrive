import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Review,
  ReviewWithProfiles,
  CreateReviewRequest,
  ReviewStatistics,
  ReviewEligibility,
  ReviewListOptions,
  ReviewerType,
} from '@/types/review';

interface ReviewStatisticsRpcResponse {
  average_rating: number | null;
  total_reviews: number | null;
  rating_5: number | null;
  rating_4: number | null;
  rating_3: number | null;
  rating_2: number | null;
  rating_1: number | null;
}

/**
 * Server-side Review Service
 * 
 * SINGLE RESPONSIBILITY: Manage review creation, retrieval, and validation
 * Handles two-way reviews (passengers review drivers and vice versa)
 */
export class ServerReviewService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new review
   */
  async createReview(
    userId: string,
    data: CreateReviewRequest
  ): Promise<{ success: boolean; review?: Review; error?: string }> {
    try {
      console.log('[REVIEW] Creating review:', { userId, bookingId: data.booking_id });

      // 1. Fetch booking with ride and user details
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select(`
          id,
          ride_id,
          user_id,
          payment_status,
          code_verified,
          status,
          ride:ride_id (
            id,
            driver_id,
            from_city,
            to_city,
            departure_time
          )
        `)
        .eq('id', data.booking_id)
        .single();

      if (bookingError || !booking) {
        console.error('[REVIEW] Booking not found:', bookingError);
        return { success: false, error: 'Booking not found' };
      }

      // 2. Verify booking is paid and verified
      if (!['completed', 'partial_refund'].includes(booking.payment_status)) {
        return { success: false, error: 'Booking must be paid to leave a review' };
      }

      if (!booking.code_verified) {
        return { success: false, error: 'Booking must be verified to leave a review' };
      }

      // 3. Determine reviewer type and reviewee
      const ride = booking.ride as any;
      let reviewerType: ReviewerType;
      let revieweeId: string;
      let revieweeType: ReviewerType;

      if (userId === booking.user_id) {
        // User is passenger, reviewing driver
        reviewerType = 'passenger';
        revieweeId = ride.driver_id;
        revieweeType = 'driver';
      } else if (userId === ride.driver_id) {
        // User is driver, reviewing passenger
        reviewerType = 'driver';
        revieweeId = booking.user_id;
        revieweeType = 'passenger';
      } else {
        return { success: false, error: 'You are not part of this booking' };
      }

      // 4. Check if review already exists
      const { data: existingReview } = await this.supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', data.booking_id)
        .eq('reviewer_id', userId)
        .single();

      if (existingReview) {
        return { success: false, error: 'You have already reviewed this booking' };
      }

      // 5. Create review
      const { data: review, error: createError } = await this.supabase
        .from('reviews')
        .insert({
          booking_id: data.booking_id,
          ride_id: booking.ride_id,
          reviewer_id: userId,
          reviewer_type: reviewerType,
          reviewee_id: revieweeId,
          reviewee_type: revieweeType,
          rating: data.rating,
          comment: data.comment || null,
          tags: data.tags || [],
          is_verified: true, // Always verified since code_verified = true
          is_public: true,
          moderation_status: 'approved', // Auto-approve for now
        })
        .select()
        .single();

      if (createError || !review) {
        console.error('[REVIEW] Error creating review:', createError);
        return { success: false, error: 'Failed to create review' };
      }

      console.log('[REVIEW] Review created successfully:', review.id);
      return { success: true, review };
    } catch (error) {
      console.error('[REVIEW] Error in createReview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create review',
      };
    }
  }

  /**
   * Get reviews for a user (as reviewee)
   */
  async getReviewsForUser(
    userId: string,
    options: ReviewListOptions = {}
  ): Promise<{ success: boolean; reviews?: ReviewWithProfiles[]; error?: string }> {
    try {
      let query = this.supabase
        .from('reviews')
        .select(`
          *,
          reviewer:reviewer_id (
            id,
            full_name,
            avatar_url
          ),
          reviewee:reviewee_id (
            id,
            full_name,
            avatar_url
          ),
          ride:ride_id (
            from_city,
            to_city,
            departure_time
          )
        `)
        .eq('reviewee_id', userId)
        .eq('is_public', true)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false });

      if (options.rating) {
        query = query.eq('rating', options.rating);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data: reviews, error } = await query;

      if (error) {
        console.error('[REVIEW] Error fetching reviews:', error);
        return { success: false, error: 'Failed to fetch reviews' };
      }

      return { success: true, reviews: reviews as ReviewWithProfiles[] };
    } catch (error) {
      console.error('[REVIEW] Error in getReviewsForUser:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reviews',
      };
    }
  }

  /**
   * Get reviews for a specific booking
   */
  async getReviewsByBooking(
    bookingId: string
  ): Promise<{ success: boolean; reviews?: Review[]; error?: string }> {
    try {
      const { data: reviews, error } = await this.supabase
        .from('reviews')
        .select('*')
        .eq('booking_id', bookingId);

      if (error) {
        console.error('[REVIEW] Error fetching reviews by booking:', error);
        return { success: false, error: 'Failed to fetch reviews' };
      }

      return { success: true, reviews: reviews as Review[] };
    } catch (error) {
      console.error('[REVIEW] Error in getReviewsByBooking:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reviews',
      };
    }
  }

  /**
   * Check if user can review a booking
   */
  async canUserReview(
    userId: string,
    bookingId: string
  ): Promise<ReviewEligibility> {
    try {
      // 1. Fetch booking
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select(`
          id,
          ride_id,
          user_id,
          payment_status,
          code_verified,
          status,
          ride:ride_id (
            id,
            driver_id,
            from_city,
            to_city,
            departure_time
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        return {
          canReview: false,
          reason: 'Booking not found',
        };
      }

      const ride = booking.ride as any;

      // 2. Check if user is part of booking
      const isPassenger = userId === booking.user_id;
      const isDriver = userId === ride.driver_id;

      if (!isPassenger && !isDriver) {
        return {
          canReview: false,
          reason: 'You are not part of this booking',
        };
      }

      // 3. Check payment status
      if (!['completed', 'partial_refund'].includes(booking.payment_status)) {
        return {
          canReview: false,
          reason: 'Booking must be paid to leave a review',
        };
      }

      // 4. Check verification
      if (!booking.code_verified) {
        return {
          canReview: false,
          reason: 'Booking must be verified to leave a review',
        };
      }

      // 5. Check minimum delay after departure
      const departureTime = new Date(ride.departure_time);
      const now = new Date();
      const hoursSinceDeparture = (now.getTime() - departureTime.getTime()) / (1000 * 60 * 60);

      if (hoursSinceDeparture < 6) {
        return {
          canReview: false,
          reason: 'Please wait at least 6 hours after departure',
        };
      }

      // 6. Check if review already exists
      const { data: existingReview } = await this.supabase
        .from('reviews')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('reviewer_id', userId)
        .single();

      if (existingReview) {
        return {
          canReview: false,
          reason: 'You have already reviewed this booking',
          existingReview: existingReview as Review,
        };
      }

      // 7. Determine reviewee
      const revieweeId = isPassenger ? ride.driver_id : booking.user_id;
      const revieweeType: ReviewerType = isPassenger ? 'driver' : 'passenger';

      // Fetch reviewee name
      const { data: reviewee } = await this.supabase
        .from('profiles')
        .select('full_name')
        .eq('id', revieweeId)
        .single();

      return {
        canReview: true,
        booking: {
          id: booking.id,
          ride_id: booking.ride_id,
          reviewee_id: revieweeId,
          reviewee_name: reviewee?.full_name || 'User',
          reviewee_type: revieweeType,
          route: `${ride.from_city} → ${ride.to_city}`,
          departure_time: ride.departure_time,
        },
      };
    } catch (error) {
      console.error('[REVIEW] Error in canUserReview:', error);
      return {
        canReview: false,
        reason: 'Failed to check eligibility',
      };
    }
  }

  /**
   * Get review statistics for a user
   */
  async getReviewStatistics(userId: string): Promise<ReviewStatistics> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_review_statistics', { p_user_id: userId })
        .single();

      if (error || !data) {
        console.error('[REVIEW] Error fetching statistics:', error);
        return {
          average_rating: 0,
          total_reviews: 0,
          rating_distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        };
      }

      const stats = data as ReviewStatisticsRpcResponse;

      return {
        average_rating: stats.average_rating || 0,
        total_reviews: stats.total_reviews || 0,
        rating_distribution: {
          5: stats.rating_5 || 0,
          4: stats.rating_4 || 0,
          3: stats.rating_3 || 0,
          2: stats.rating_2 || 0,
          1: stats.rating_1 || 0,
        },
      };
    } catch (error) {
      console.error('[REVIEW] Error in getReviewStatistics:', error);
      return {
        average_rating: 0,
        total_reviews: 0,
        rating_distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }
  }
}
