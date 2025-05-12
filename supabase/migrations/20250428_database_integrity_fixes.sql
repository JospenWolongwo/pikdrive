-- Migration to improve database integrity and consistency

-- 1. Create trigger to automatically create profile entries for new users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_driver, driver_status, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, false, 'pending', 'user', NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists to avoid errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger to run after user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Add foreign key constraint to driver_documents table
ALTER TABLE public.driver_documents
  DROP CONSTRAINT IF EXISTS driver_documents_driver_id_fkey,
  ADD CONSTRAINT driver_documents_driver_id_fkey 
  FOREIGN KEY (driver_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- 3. Fix existing inconsistencies: create profiles for auth users without profiles
INSERT INTO public.profiles (id, email, is_driver, driver_status, role, created_at, updated_at)
SELECT 
  au.id, 
  au.email, 
  false, -- is_driver
  'pending', -- driver_status 
  'user', -- role
  NOW(), -- created_at
  NOW() -- updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 4. Optional: Add NOT NULL constraints to critical fields if they don't have them
ALTER TABLE public.profiles
  ALTER COLUMN is_driver SET NOT NULL,
  ALTER COLUMN driver_status SET NOT NULL,
  ALTER COLUMN role SET NOT NULL;

-- 5. Add indexes for common query patterns if they don't exist
CREATE INDEX IF NOT EXISTS idx_profiles_is_driver ON public.profiles(is_driver);
CREATE INDEX IF NOT EXISTS idx_profiles_driver_status ON public.profiles(driver_status);

-- 6. Consider removing public.users table if it's redundant and not referenced elsewhere
-- IMPORTANT: Verify no dependencies before running this!
DROP TABLE IF EXISTS public.users;

-- COMMENT OUT THE ABOVE LINE AND UNCOMMENT ONLY AFTER VERIFYING IT'S SAFE TO DROP
