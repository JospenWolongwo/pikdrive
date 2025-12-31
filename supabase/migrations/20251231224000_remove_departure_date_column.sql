-- Remove departure_date column from rides table if it exists
-- This column is not part of the schema and was likely added manually
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'rides'
    AND column_name = 'departure_date'
  ) THEN
    ALTER TABLE "public"."rides"
    DROP COLUMN "departure_date" CASCADE;
  END IF;
END $$;

