-- Migration to update profile is_driver status when driver documents are added

-- Create function to update profile when driver documents are added/updated
CREATE OR REPLACE FUNCTION public.update_profile_driver_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a driver document is inserted or updated, set the profile's is_driver flag to true
  UPDATE public.profiles
  SET 
    is_driver = TRUE,
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_driver_document_change ON public.driver_documents;

-- Create trigger to run after document insert or update
CREATE TRIGGER on_driver_document_change
  AFTER INSERT OR UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_driver_status();

-- One-time update to fix existing inconsistencies
-- Update all profiles linked to driver_documents to have is_driver=true
UPDATE public.profiles 
SET 
  is_driver = TRUE,
  driver_status = CASE 
    WHEN driver_status IN ('approved', 'rejected') THEN driver_status
    ELSE 'pending'
  END,
  updated_at = NOW()
WHERE id IN (SELECT DISTINCT driver_id FROM public.driver_documents);

-- Log completion message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Driver document trigger and profile update applied';
END $$;
