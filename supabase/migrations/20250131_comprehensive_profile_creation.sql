-- Migration to ensure comprehensive profile creation for new users
-- This ensures that when users sign up via phone OTP, a complete profile is created
-- with all necessary fields matching the profiles table structure

-- Update the handle_new_user function to include all necessary profile fields
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    phone, 
    email, 
    full_name,
    city,
    avatar_url,
    is_driver, 
    driver_status, 
    role,
    driver_application_status,
    driver_application_date,
    is_driver_applicant,
    created_by,
    updated_by,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.phone,                    -- Copy phone from auth.users (primary registration method)
    NEW.email,                    -- Copy email from auth.users (if provided)
    NULL,                         -- full_name - null until user updates profile
    NULL,                         -- city - null until user updates profile  
    NULL,                         -- avatar_url - null until user uploads avatar
    false,                        -- is_driver - default to false
    'pending',                    -- driver_status - default to pending
    'user',                       -- role - default to user
    'pending',                    -- driver_application_status - default to pending
    NULL,                         -- driver_application_date - null until they apply
    false,                        -- is_driver_applicant - default to false
    NULL,                         -- created_by - null for self-registration
    NULL,                         -- updated_by - null initially
    NOW(),                        -- created_at - current timestamp
    NOW()                         -- updated_at - current timestamp
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the trigger to run after user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix existing profiles that might be missing fields
-- Update profiles with phone numbers from auth.users where phone is null
UPDATE public.profiles 
SET 
  phone = auth_users.phone,
  updated_at = NOW()
FROM auth.users auth_users
WHERE public.profiles.id = auth_users.id 
  AND public.profiles.phone IS NULL 
  AND auth_users.phone IS NOT NULL;

-- Ensure all existing profiles have proper default values for new fields
UPDATE public.profiles 
SET 
  is_driver = COALESCE(is_driver, false),
  driver_status = COALESCE(driver_status, 'pending'),
  role = COALESCE(role, 'user'),
  driver_application_status = COALESCE(driver_application_status, 'pending'),
  is_driver_applicant = COALESCE(is_driver_applicant, false),
  updated_at = NOW()
WHERE 
  is_driver IS NULL 
  OR driver_status IS NULL 
  OR role IS NULL 
  OR driver_application_status IS NULL 
  OR is_driver_applicant IS NULL;

-- Log the fix
DO $$
DECLARE
  updated_count INTEGER;
  profile_count INTEGER;
BEGIN
  -- Get count of updated phone numbers
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Get total profile count
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  
  RAISE NOTICE 'Profile creation fix complete:';
  RAISE NOTICE '- Updated % profiles with phone numbers from auth.users', updated_count;
  RAISE NOTICE '- Total profiles in database: %', profile_count;
  RAISE NOTICE '- All new users will automatically get complete profiles';
END $$;
