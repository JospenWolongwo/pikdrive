-- Prevent duplicate bookings by the same user for the same ride
-- This ensures data integrity at the database level

-- Add unique constraint to prevent duplicate bookings
ALTER TABLE public.bookings 
ADD CONSTRAINT unique_user_ride_booking 
UNIQUE (user_id, ride_id);

-- Add index for better performance on the constraint
CREATE INDEX IF NOT EXISTS idx_bookings_user_ride 
ON public.bookings (user_id, ride_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT unique_user_ride_booking ON public.bookings 
IS 'Prevents users from creating multiple bookings for the same ride';
