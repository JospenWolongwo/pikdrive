-- Fix rides_driver_id_fkey to reference profiles instead of users
DO $$
BEGIN
  -- Drop the existing constraint if it exists (regardless of what it references)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rides_driver_id_fkey' 
    AND conrelid = 'public.rides'::regclass
  ) THEN
    ALTER TABLE "public"."rides"
    DROP CONSTRAINT "rides_driver_id_fkey";
  END IF;
  
  -- Recreate it to point to the correct table (public.profiles)
  ALTER TABLE "public"."rides"
  ADD CONSTRAINT "rides_driver_id_fkey" 
  FOREIGN KEY ("driver_id") 
  REFERENCES "public"."profiles"("id") 
  ON DELETE CASCADE;
END $$;

