-- Fix driver_documents table schema to match what the form actually collects
-- The form only collects file uploads, not document numbers

-- First, let's see what we have
DO $$
BEGIN
  RAISE NOTICE 'Current driver_documents schema:';
  RAISE NOTICE 'national_id_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'national_id_number');
  RAISE NOTICE 'license_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'license_number');
  RAISE NOTICE 'registration_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'registration_number');
  RAISE NOTICE 'insurance_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'insurance_number');
  RAISE NOTICE 'technical_inspection_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'technical_inspection_number');
  RAISE NOTICE 'road_tax_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'road_tax_number');
END $$;

-- Make document number fields nullable since the form doesn't collect them
ALTER TABLE public.driver_documents 
ALTER COLUMN national_id_number DROP NOT NULL,
ALTER COLUMN license_number DROP NOT NULL,
ALTER COLUMN registration_number DROP NOT NULL,
ALTER COLUMN insurance_number DROP NOT NULL,
ALTER COLUMN technical_inspection_number DROP NOT NULL;

-- Set default values for the document number fields
ALTER TABLE public.driver_documents 
ALTER COLUMN national_id_number SET DEFAULT '',
ALTER COLUMN license_number SET DEFAULT '',
ALTER COLUMN registration_number SET DEFAULT '',
ALTER COLUMN insurance_number SET DEFAULT '',
ALTER COLUMN technical_inspection_number SET DEFAULT '';

-- Update existing records to have empty strings instead of NULL
UPDATE public.driver_documents 
SET 
  national_id_number = COALESCE(national_id_number, ''),
  license_number = COALESCE(license_number, ''),
  registration_number = COALESCE(registration_number, ''),
  insurance_number = COALESCE(insurance_number, ''),
  technical_inspection_number = COALESCE(technical_inspection_number, '')
WHERE 
  national_id_number IS NULL 
  OR license_number IS NULL 
  OR registration_number IS NULL 
  OR insurance_number IS NULL 
  OR technical_inspection_number IS NULL;

-- Now make them NOT NULL again with default values
ALTER TABLE public.driver_documents 
ALTER COLUMN national_id_number SET NOT NULL,
ALTER COLUMN license_number SET NOT NULL,
ALTER COLUMN registration_number SET NOT NULL,
ALTER COLUMN insurance_number SET NOT NULL,
ALTER COLUMN technical_inspection_number SET NOT NULL;

-- Add comments to clarify the purpose of each field
COMMENT ON COLUMN public.driver_documents.national_id_number IS 'National ID number (optional, defaults to empty string)';
COMMENT ON COLUMN public.driver_documents.license_number IS 'Driver license number (optional, defaults to empty string)';
COMMENT ON COLUMN public.driver_documents.registration_number IS 'Vehicle registration number (optional, defaults to empty string)';
COMMENT ON COLUMN public.driver_documents.insurance_number IS 'Insurance number (optional, defaults to empty string)';
COMMENT ON COLUMN public.driver_documents.technical_inspection_number IS 'Technical inspection number (optional, defaults to empty string)';
COMMENT ON COLUMN public.driver_documents.road_tax_number IS 'Road tax number (optional)';

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'After fix, driver_documents schema:';
  RAISE NOTICE 'national_id_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'national_id_number');
  RAISE NOTICE 'license_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'license_number');
  RAISE NOTICE 'registration_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'registration_number');
  RAISE NOTICE 'insurance_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'insurance_number');
  RAISE NOTICE 'technical_inspection_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'technical_inspection_number');
  RAISE NOTICE 'road_tax_number: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'road_tax_number');
END $$; 