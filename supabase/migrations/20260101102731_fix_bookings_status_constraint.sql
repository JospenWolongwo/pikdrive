-- Fix bookings status constraint to include all valid status values
-- The constraint should allow: pending, pending_verification, confirmed, completed, cancelled

DO $$
BEGIN
  -- Drop existing constraint if it exists (might have wrong values)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_status_check' 
    AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE "public"."bookings"
    DROP CONSTRAINT "bookings_status_check";
  END IF;
  
  -- Add the correct constraint with all valid status values
  ALTER TABLE "public"."bookings"
  ADD CONSTRAINT "bookings_status_check" 
  CHECK (status IN ('pending', 'pending_verification', 'confirmed', 'completed', 'cancelled', 'expired'));
END $$;

