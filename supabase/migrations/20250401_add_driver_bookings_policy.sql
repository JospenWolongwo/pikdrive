-- Add policy to allow drivers to view bookings for their rides
DROP POLICY IF EXISTS "Drivers can view bookings for their rides" ON public.bookings;
CREATE POLICY "Drivers can view bookings for their rides" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = bookings.ride_id
      AND rides.driver_id = auth.uid()
    )
  );

-- Add policy to allow drivers to update verification status
DROP POLICY IF EXISTS "Drivers can update verification status" ON public.bookings;
CREATE POLICY "Drivers can update verification status" ON public.bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = bookings.ride_id
      AND rides.driver_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = bookings.ride_id
      AND rides.driver_id = auth.uid()
    )
  );

-- Ensure drivers can see verification codes for their rides' bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
