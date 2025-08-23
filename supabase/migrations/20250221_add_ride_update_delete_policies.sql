-- Migration to add missing RLS policies for rides table
-- This allows drivers to update and delete their own rides

-- Policy: Drivers can update their own rides
CREATE POLICY "Drivers can update their own rides" ON public.rides
FOR UPDATE USING (auth.uid() = driver_id);

-- Policy: Drivers can delete their own rides
CREATE POLICY "Drivers can delete their own rides" ON public.rides
FOR DELETE USING (auth.uid() = driver_id);

-- Add comments to clarify the purpose
COMMENT ON POLICY "Drivers can update their own rides" ON public.rides IS 'Allows authenticated drivers to update rides they created';
COMMENT ON POLICY "Drivers can delete their own rides" ON public.rides IS 'Allows authenticated drivers to delete rides they created';
