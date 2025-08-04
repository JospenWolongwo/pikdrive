-- Migration to add missing driver application fields to profiles table
-- This fixes the "Could not find the 'driver_application_date' column" error

-- Add missing driver application fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS driver_application_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS driver_application_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_driver_applicant BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS driver_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT,
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS registration_number TEXT,
ADD COLUMN IF NOT EXISTS insurance_number TEXT,
ADD COLUMN IF NOT EXISTS road_tax_number TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_driver_application_status ON public.profiles(driver_application_status);
CREATE INDEX IF NOT EXISTS idx_profiles_driver_status ON public.profiles(driver_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_driver ON public.profiles(is_driver);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Add constraints to ensure data integrity
ALTER TABLE public.profiles 
ALTER COLUMN driver_application_status SET NOT NULL,
ALTER COLUMN is_driver_applicant SET NOT NULL,
ALTER COLUMN is_driver SET NOT NULL,
ALTER COLUMN driver_status SET NOT NULL,
ALTER COLUMN role SET NOT NULL;

-- Add check constraints for valid values
ALTER TABLE public.profiles 
ADD CONSTRAINT check_driver_application_status 
CHECK (driver_application_status IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE public.profiles 
ADD CONSTRAINT check_driver_status 
CHECK (driver_status IN ('pending', 'approved', 'rejected', 'inactive'));

ALTER TABLE public.profiles 
ADD CONSTRAINT check_role 
CHECK (role IN ('user', 'driver', 'admin'));

-- Update existing profiles to have proper default values
UPDATE public.profiles 
SET 
  driver_application_status = COALESCE(driver_application_status, 'pending'),
  is_driver_applicant = COALESCE(is_driver_applicant, FALSE),
  is_driver = COALESCE(is_driver, FALSE),
  driver_status = COALESCE(driver_status, 'pending'),
  role = COALESCE(role, 'user')
WHERE 
  driver_application_status IS NULL 
  OR is_driver_applicant IS NULL 
  OR is_driver IS NULL 
  OR driver_status IS NULL 
  OR role IS NULL;

-- Create a function to automatically update driver_application_date when status changes
CREATE OR REPLACE FUNCTION update_driver_application_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Set application date when status changes to pending
  IF NEW.driver_application_status = 'pending' AND 
     (OLD.driver_application_status IS NULL OR OLD.driver_application_status != 'pending') THEN
    NEW.driver_application_date = NOW();
  END IF;
  
  -- Set is_driver_applicant to true when application status is set
  IF NEW.driver_application_status IS NOT NULL AND 
     (OLD.driver_application_status IS NULL OR OLD.driver_application_status != NEW.driver_application_status) THEN
    NEW.is_driver_applicant = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update driver_application_date
DROP TRIGGER IF EXISTS trigger_update_driver_application_date ON public.profiles;
CREATE TRIGGER trigger_update_driver_application_date
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_application_date();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated; 