-- Fix RLS policies on bookings table so drivers can see bookings for their rides
-- This is needed for the driver dashboard to properly show booking counts

-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.bookings;

-- Create the correct policy that allows both users and drivers to see relevant bookings
CREATE POLICY "Users and drivers can view relevant bookings"
    ON public.bookings
    FOR SELECT
    USING (
        -- Users can see their own bookings
        auth.uid() = user_id 
        OR 
        -- Drivers can see bookings for their rides
        EXISTS (
            SELECT 1 FROM rides
            WHERE rides.id = bookings.ride_id
            AND rides.driver_id = auth.uid()
        )
    );

-- Ensure the policy is applied
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON public.bookings TO authenticated;
