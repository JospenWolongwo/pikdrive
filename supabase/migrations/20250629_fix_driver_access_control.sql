-- Migration to fix driver access control issue
-- This prevents users from automatically getting driver access when submitting applications

-- First, fix existing data: set is_driver = false for all pending applications
UPDATE public.profiles 
SET 
  is_driver = FALSE,
  updated_at = NOW()
WHERE 
  driver_application_status = 'pending' 
  AND driver_status = 'pending'
  AND is_driver = TRUE;

-- Update the trigger function to not automatically set is_driver = TRUE
CREATE OR REPLACE FUNCTION public.update_profile_driver_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a driver document is inserted or updated, only update driver_status to pending
  -- DO NOT set is_driver = TRUE automatically - this should only happen after admin approval
  UPDATE public.profiles
  SET 
    -- Only update driver_status if it's not already set to approved or rejected
    driver_status = CASE 
      WHEN driver_status IN ('approved', 'rejected') THEN driver_status
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = NEW.driver_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_driver_document_change ON public.driver_documents;

CREATE TRIGGER on_driver_document_change
  AFTER INSERT OR UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_driver_status();

-- Log completion message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Driver access control fixed - users no longer get automatic driver access';
END $$;
