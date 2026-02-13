-- ============================================================================
-- Reviews System Implementation
-- ============================================================================
-- Two-way review system allowing passengers and drivers to review each other
-- Reviews are collected 6-7 hours after ride completion via WhatsApp
-- ============================================================================

-- ============================================================================
-- PART 1: Create Reviews Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  
  -- Who is giving the review
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('passenger', 'driver')),
  
  -- Who is being reviewed
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_type TEXT NOT NULL CHECK (reviewee_type IN ('passenger', 'driver')),
  
  -- Review content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- Categorized feedback (tags stored as JSONB array)
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- Visibility and verification
  is_public BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT TRUE, -- Only verified rides get public reviews
  
  -- Moderation
  is_flagged BOOLEAN DEFAULT FALSE,
  moderation_status TEXT DEFAULT 'approved' 
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(booking_id, reviewer_id), -- One review per booking per reviewer
  CHECK (reviewer_id != reviewee_id) -- Can't review yourself
);

ALTER TABLE public.reviews OWNER TO postgres;

-- Comments
COMMENT ON TABLE public.reviews IS 'Two-way review system: passengers review drivers and vice versa';
COMMENT ON COLUMN public.reviews.reviewer_type IS 'Type of reviewer: passenger or driver';
COMMENT ON COLUMN public.reviews.reviewee_type IS 'Type of reviewee: passenger or driver';
COMMENT ON COLUMN public.reviews.is_verified IS 'True if review is from a verified booking (code_verified = true)';
COMMENT ON COLUMN public.reviews.tags IS 'Categorized feedback tags: punctual, friendly, clean_car, safe_driver, respectful';

-- ============================================================================
-- PART 2: Create Indexes for Performance
-- ============================================================================

CREATE INDEX idx_reviews_booking_id ON public.reviews(booking_id);
CREATE INDEX idx_reviews_ride_id ON public.reviews(ride_id);
CREATE INDEX idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX idx_reviews_rating ON public.reviews(rating);
CREATE INDEX idx_reviews_created_at ON public.reviews(created_at DESC);
CREATE INDEX idx_reviews_moderation_status ON public.reviews(moderation_status);
CREATE INDEX idx_reviews_public_approved ON public.reviews(is_public, moderation_status) 
  WHERE is_public = TRUE AND moderation_status = 'approved';

-- ============================================================================
-- PART 3: Add Rating Columns to Profiles Table
-- ============================================================================

-- Add rating statistics columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(2,1) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_trips_completed INTEGER DEFAULT 0;

-- Comments
COMMENT ON COLUMN public.profiles.average_rating IS 'Calculated average rating from approved reviews';
COMMENT ON COLUMN public.profiles.total_reviews IS 'Total count of approved public reviews';
COMMENT ON COLUMN public.profiles.total_trips_completed IS 'Total number of verified completed trips';

-- Create index for rating lookups
CREATE INDEX IF NOT EXISTS idx_profiles_average_rating ON public.profiles(average_rating);

-- ============================================================================
-- PART 4: Auto-Update Profile Rating Trigger
-- ============================================================================

-- Function to update profile rating when new review is added
CREATE OR REPLACE FUNCTION public.update_profile_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update reviewee's average rating and total reviews
  UPDATE public.profiles
  SET 
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM public.reviews
      WHERE reviewee_id = NEW.reviewee_id
        AND is_public = TRUE
        AND moderation_status = 'approved'
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE reviewee_id = NEW.reviewee_id
        AND is_public = TRUE
        AND moderation_status = 'approved'
    ),
    updated_at = NOW()
  WHERE id = NEW.reviewee_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.update_profile_rating() OWNER TO postgres;

COMMENT ON FUNCTION public.update_profile_rating() IS 'Automatically updates profile rating statistics when reviews are created or updated';

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_profile_rating ON public.reviews;
CREATE TRIGGER trigger_update_profile_rating
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_rating();

-- ============================================================================
-- PART 5: Enable RLS and Create Policies
-- ============================================================================

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public can view approved, public reviews
CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT USING (
    is_public = TRUE 
    AND moderation_status = 'approved'
  );

-- Users can view their own reviews (as reviewer or reviewee)
CREATE POLICY "reviews_select_own" ON public.reviews
  FOR SELECT USING (
    auth.uid() = reviewer_id 
    OR auth.uid() = reviewee_id
  );

-- Authenticated users can insert reviews (validation in service layer)
CREATE POLICY "reviews_insert_authenticated" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
  );

-- Users can update their own reviews (only comment and tags, not rating)
CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE USING (
    auth.uid() = reviewer_id
  );

-- ============================================================================
-- PART 6: Grant Permissions
-- ============================================================================

GRANT ALL ON TABLE public.reviews TO postgres;
GRANT SELECT ON TABLE public.reviews TO anon;
GRANT SELECT ON TABLE public.reviews TO authenticated;
GRANT INSERT ON TABLE public.reviews TO authenticated;
GRANT UPDATE ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;

GRANT EXECUTE ON FUNCTION public.update_profile_rating() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_profile_rating() TO service_role;

-- ============================================================================
-- PART 7: Helper Function to Get Review Statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_review_statistics(p_user_id UUID)
RETURNS TABLE (
  average_rating DECIMAL(2,1),
  total_reviews INTEGER,
  rating_5 INTEGER,
  rating_4 INTEGER,
  rating_3 INTEGER,
  rating_2 INTEGER,
  rating_1 INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(r.rating)::numeric, 1) as average_rating,
    COUNT(*)::INTEGER as total_reviews,
    COUNT(*) FILTER (WHERE r.rating = 5)::INTEGER as rating_5,
    COUNT(*) FILTER (WHERE r.rating = 4)::INTEGER as rating_4,
    COUNT(*) FILTER (WHERE r.rating = 3)::INTEGER as rating_3,
    COUNT(*) FILTER (WHERE r.rating = 2)::INTEGER as rating_2,
    COUNT(*) FILTER (WHERE r.rating = 1)::INTEGER as rating_1
  FROM public.reviews r
  WHERE r.reviewee_id = p_user_id
    AND r.is_public = TRUE
    AND r.moderation_status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_review_statistics(UUID) OWNER TO postgres;

COMMENT ON FUNCTION public.get_review_statistics(UUID) IS 'Returns review statistics including rating distribution for a user';

GRANT EXECUTE ON FUNCTION public.get_review_statistics(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_review_statistics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_review_statistics(UUID) TO service_role;

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Reviews system migration completed successfully!';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Created reviews table with two-way review support';
  RAISE NOTICE '  - Added rating columns to profiles table';
  RAISE NOTICE '  - Created auto-update trigger for profile ratings';
  RAISE NOTICE '  - Added RLS policies for security';
  RAISE NOTICE '  - Created helper function for statistics';
END $$;
