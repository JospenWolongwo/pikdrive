-- Add submission_timestamp column to driver_documents table
ALTER TABLE public.driver_documents
ADD COLUMN IF NOT EXISTS submission_timestamp TIMESTAMPTZ DEFAULT now();

-- Add vehicle_images column to store the array of image URLs
ALTER TABLE public.driver_documents
ADD COLUMN IF NOT EXISTS vehicle_images TEXT[] DEFAULT '{}'::TEXT[];

-- Ensure the RLS policies allow access to these new columns
-- Policies were already set up for the table in previous migrations

-- Update the schema cache
NOTIFY pgrst, 'reload schema';
