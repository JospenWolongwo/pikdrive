-- Fix departure_time column type in rides table
-- If the column is 'time' type, drop and recreate it as 'timestamp with time zone'
DO $$
BEGIN
  -- Check if the column exists and if it's the wrong type (time instead of timestamp with time zone)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'rides'
    AND column_name = 'departure_time'
    AND data_type = 'time'
  ) THEN
    -- Drop the column and recreate it with the correct type
    -- This is safe for UAT where the table should be empty or newly created
    ALTER TABLE "public"."rides"
    DROP COLUMN IF EXISTS "departure_time";
    
    ALTER TABLE "public"."rides"
    ADD COLUMN "departure_time" timestamp with time zone NOT NULL;
  END IF;
END $$;

