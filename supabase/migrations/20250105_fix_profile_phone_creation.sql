-- Migration to fix profile creation to include phone number from auth.users
-- This ensures that when users sign up via phone OTP, their phone number is copied to the profiles table

-- Update the handle_new_user function to include phone number
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
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
  VALUES (
    NEW.id, 
    NEW.phone, -- Include phone number from auth.users
    NEW.email, 
    false, 
    'pending', 
    'user', 
    NOW(), 
    NOW()
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

-- Fix existing profiles that don't have phone numbers
-- Update profiles with phone numbers from auth.users where phone is null
UPDATE public.profiles 
SET phone = auth_users.phone
FROM auth.users auth_users
WHERE public.profiles.id = auth_users.id 
  AND public.profiles.phone IS NULL 
  AND auth_users.phone IS NOT NULL;

-- Log the fix
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % profiles with phone numbers from auth.users', updated_count;
END $$;
