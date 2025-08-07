-- Migration to create profiles for existing auth.users that don't have profiles
-- This ensures all users have profiles with their phone numbers

-- Create profiles for auth users that don't have profiles yet
INSERT INTO public.profiles (
  id, 
  phone, 
  email, 
  is_driver, 
  driver_status, 
  role, 
  created_at, 
  updated_at
)
SELECT 
  au.id, 
  au.phone, -- Include phone number from auth.users
  au.email, 
  false, -- is_driver
  'pending', -- driver_status 
  'user', -- role
  NOW(), -- created_at
  NOW() -- updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Log how many profiles were created
DO $$
DECLARE
  created_count INTEGER;
BEGIN
  GET DIAGNOSTICS created_count = ROW_COUNT;
  RAISE NOTICE 'Created % new profiles for existing auth users', created_count;
END $$;
