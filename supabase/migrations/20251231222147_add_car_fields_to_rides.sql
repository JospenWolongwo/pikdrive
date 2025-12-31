-- Ensure rides table has car_model and car_color columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' 
    AND column_name = 'car_model'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE "public"."rides" 
    ADD COLUMN "car_model" "text";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' 
    AND column_name = 'car_color'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE "public"."rides" 
    ADD COLUMN "car_color" "text";
  END IF;
END $$;

