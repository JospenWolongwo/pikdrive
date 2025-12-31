-- Fix departure_time column type in rides table (more robust version)
-- Drop indexes and constraints first, then fix the column type
DO $$
BEGIN
  -- Drop index on departure_time if it exists (it will be recreated by the main migration)
  DROP INDEX IF EXISTS "public"."idx_rides_departure";
  
  -- Check the actual column type using UDT name (more reliable than data_type)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'rides'
    AND column_name = 'departure_time'
    AND (udt_name = 'time' OR udt_name = 'timetz' OR data_type = 'time' OR data_type = 'time without time zone')
  ) THEN
    -- Drop the column (this will also drop any constraints/indexes on it)
    ALTER TABLE "public"."rides"
    DROP COLUMN IF EXISTS "departure_time" CASCADE;
    
    -- Recreate it with the correct type
    ALTER TABLE "public"."rides"
    ADD COLUMN "departure_time" timestamp with time zone NOT NULL;
  END IF;
END $$;

-- Recreate the index if the column was fixed
CREATE INDEX IF NOT EXISTS "idx_rides_departure" ON "public"."rides" USING "btree" ("departure_time");

