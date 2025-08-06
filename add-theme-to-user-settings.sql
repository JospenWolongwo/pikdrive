-- Add theme field to user_settings table
-- This allows users to persist their theme preference in the database

ALTER TABLE public.user_settings 
ADD COLUMN theme character varying(10) NULL DEFAULT 'system'::character varying;

-- Add comment to document the field
COMMENT ON COLUMN public.user_settings.theme IS 'User theme preference: light, dark, or system';

-- Update existing records to have 'system' as default theme
UPDATE public.user_settings 
SET theme = 'system' 
WHERE theme IS NULL; 