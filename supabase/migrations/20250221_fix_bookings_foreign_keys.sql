-- Fix foreign key relationships for bookings table
-- This ensures proper joins between bookings, users, and profiles

-- First, check what foreign keys exist
DO $$
BEGIN
  RAISE NOTICE 'Checking current foreign key constraints on bookings table...';
  
  -- Check if user_id references auth.users
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' 
    AND constraint_name LIKE '%user_id%'
  ) THEN
    RAISE NOTICE 'user_id foreign key constraint exists';
  ELSE
    RAISE NOTICE 'user_id foreign key constraint MISSING';
  END IF;
  
  -- Check if ride_id references rides
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' 
    AND constraint_name LIKE '%ride_id%'
  ) THEN
    RAISE NOTICE 'ride_id foreign key constraint exists';
  ELSE
    RAISE NOTICE 'ride_id foreign key constraint MISSING';
  END IF;
END $$;

-- Add missing foreign key constraints if they don't exist
DO $$
BEGIN
  -- Add user_id foreign key to auth.users if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' 
    AND constraint_name LIKE '%user_id%'
  ) THEN
    ALTER TABLE public.bookings 
    ADD CONSTRAINT bookings_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added user_id foreign key constraint';
  END IF;
  
  -- Add ride_id foreign key to rides if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' 
    AND constraint_name LIKE '%ride_id%'
  ) THEN
    ALTER TABLE public.bookings 
    ADD CONSTRAINT bookings_ride_id_fkey 
    FOREIGN KEY (ride_id) REFERENCES public.rides(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added ride_id foreign key constraint';
  END IF;
END $$;

-- Create a view that properly joins bookings with user profiles
CREATE OR REPLACE VIEW bookings_with_profiles AS
SELECT 
  b.*,
  p.full_name,
  p.avatar_url
FROM public.bookings b
LEFT JOIN public.profiles p ON b.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON bookings_with_profiles TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW bookings_with_profiles IS 'View that joins bookings with user profile information for easier querying';
