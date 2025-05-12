-- Update driver_documents table to support document file uploads
ALTER TABLE public.driver_documents
-- Remove the road_tax_number column as per simplified requirements
ALTER COLUMN road_tax_number DROP NOT NULL;

-- Add new document file columns
ALTER TABLE public.driver_documents
ADD COLUMN IF NOT EXISTS national_id_file TEXT,
ADD COLUMN IF NOT EXISTS license_file TEXT,
ADD COLUMN IF NOT EXISTS registration_file TEXT,
ADD COLUMN IF NOT EXISTS insurance_file TEXT,
ADD COLUMN IF NOT EXISTS technical_inspection_file TEXT;

-- Update RLS policies to allow access to the new columns
DROP POLICY IF EXISTS "Drivers can view their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Drivers can insert their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Admins can view all driver documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Admins can update driver documents" ON public.driver_documents;

-- Recreate policies
CREATE POLICY "Drivers can view their own documents" ON public.driver_documents 
FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own documents" ON public.driver_documents 
FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins can view all driver documents" ON public.driver_documents 
FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update driver documents" ON public.driver_documents 
FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');
