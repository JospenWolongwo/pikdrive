-- Add INSERT policy for bookings
DROP POLICY IF EXISTS "Users can insert their own bookings" ON public.bookings;
CREATE POLICY "Users can insert their own bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for bookings
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
CREATE POLICY "Users can update their own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

-- Add DELETE policy for bookings
DROP POLICY IF EXISTS "Users can delete their own bookings" ON public.bookings;
CREATE POLICY "Users can delete their own bookings" ON public.bookings
  FOR DELETE USING (auth.uid() = user_id);

-- Grant API service role access to handle booking operations
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.bookings TO service_role;
GRANT ALL ON public.payment_receipts TO service_role;
