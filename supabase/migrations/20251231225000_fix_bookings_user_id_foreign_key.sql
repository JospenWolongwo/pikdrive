-- Fix bookings_user_id_fkey to reference profiles instead of users
DO $$
BEGIN
  -- Drop the existing constraint if it exists (regardless of what it references)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_user_id_fkey' 
    AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE "public"."bookings"
    DROP CONSTRAINT "bookings_user_id_fkey";
  END IF;
  
  -- Recreate it to point to the correct table (public.profiles)
  ALTER TABLE "public"."bookings"
  ADD CONSTRAINT "bookings_user_id_fkey" 
  FOREIGN KEY ("user_id") 
  REFERENCES "public"."profiles"("id") 
  ON DELETE CASCADE;
END $$;

