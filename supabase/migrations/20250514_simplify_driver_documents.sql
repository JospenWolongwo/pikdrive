-- Migration to simplify driver documents requirements
-- Only requiring 4 essential document images: ID, License, Registration, and Insurance
-- Making all number fields optional for a simpler user experience

-- 1. Make all document number fields nullable, keeping only file uploads as required
ALTER TABLE public.driver_documents
  ALTER COLUMN national_id_number DROP NOT NULL,
  ALTER COLUMN license_number DROP NOT NULL,
  ALTER COLUMN registration_number DROP NOT NULL,
  ALTER COLUMN insurance_number DROP NOT NULL,
  ALTER COLUMN technical_inspection_number DROP NOT NULL,
  ALTER COLUMN technical_inspection_file DROP NOT NULL,
  ALTER COLUMN road_tax_number DROP NOT NULL;

-- 2. Add comment to document what is required for driver verification
COMMENT ON TABLE public.driver_documents IS 'Required documents: National ID, Driver License, Vehicle Registration, and Insurance';

-- 3. Set default empty values for non-essential fields
UPDATE public.driver_documents
SET 
  technical_inspection_number = NULL,
  technical_inspection_file = NULL,
  road_tax_number = NULL
WHERE technical_inspection_number IS NOT NULL OR road_tax_number IS NOT NULL;

-- 4. Update any validation triggers or functions to only check for the required documents
CREATE OR REPLACE FUNCTION public.validate_driver_documents()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check required files - no longer validating document numbers
  IF NEW.national_id_file IS NULL OR NEW.license_file IS NULL OR 
     NEW.registration_file IS NULL OR NEW.insurance_file IS NULL THEN
    RAISE EXCEPTION 'Missing required document files';
  END IF;
  
  -- If all checks pass
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the validation trigger
DROP TRIGGER IF EXISTS validate_driver_documents_trigger ON public.driver_documents;
CREATE TRIGGER validate_driver_documents_trigger
  BEFORE INSERT OR UPDATE ON public.driver_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_driver_documents();

-- 5. Update document status metadata
CREATE OR REPLACE FUNCTION public.update_driver_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If all required documents are provided, update status to 'submitted'
  IF NEW.national_id_file IS NOT NULL AND 
     NEW.license_file IS NOT NULL AND 
     NEW.registration_file IS NOT NULL AND 
     NEW.insurance_file IS NOT NULL THEN
    
    UPDATE public.profiles
    SET driver_status = 'submitted'
    WHERE id = NEW.driver_id AND driver_status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for driver status updates
DROP TRIGGER IF EXISTS update_driver_status_trigger ON public.driver_documents;
CREATE TRIGGER update_driver_status_trigger
  AFTER INSERT OR UPDATE ON public.driver_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_driver_status();

-- Update the schema cache
NOTIFY pgrst, 'reload schema';
