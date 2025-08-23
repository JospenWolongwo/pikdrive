-- Migration to add the missing description column to the rides table
-- This fixes the error when updating rides with description field

-- Add the description column
ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN public.rides.description IS 'Optional description for the ride (stops, rules, etc.)';

-- Update existing rides to have empty description if they don't have one
UPDATE public.rides 
SET description = '' 
WHERE description IS NULL;
