-- Migration to fix the price column type from DECIMAL to INTEGER
-- This ensures consistency and avoids floating-point precision issues

-- First, check the current column type
DO $$
DECLARE
    current_type text;
BEGIN
    SELECT data_type INTO current_type
    FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'price';
    
    RAISE NOTICE 'Current price column type: %', current_type;
    
    -- Only proceed if the column is currently DECIMAL
    IF current_type = 'numeric' OR current_type = 'decimal' THEN
        -- Convert DECIMAL to INTEGER
        ALTER TABLE public.rides ALTER COLUMN price TYPE INTEGER USING price::integer;
        RAISE NOTICE 'Successfully converted price column from % to INTEGER', current_type;
    ELSE
        RAISE NOTICE 'Price column is already INTEGER or different type: %. No conversion needed.', current_type;
    END IF;
END $$;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN public.rides.price IS 'Price in FCFA (whole numbers only)';
