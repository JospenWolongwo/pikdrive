-- ============================================================================
-- Add pickup point fields to bookings table
-- ============================================================================
-- Adds fields to track which pickup point passenger selected and calculated pickup time.
-- ============================================================================

-- Add selected_pickup_point_id (references id in ride's pickup_points array)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS selected_pickup_point_id TEXT;

-- Add pickup_point_name (denormalized for display/WhatsApp)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS pickup_point_name TEXT;

-- Add pickup_time (calculated from ride departure_time + time_offset_minutes)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMP WITH TIME ZONE;

-- Add comments to document the fields
COMMENT ON COLUMN public.bookings.selected_pickup_point_id IS 
'ID of the pickup point selected by passenger (references id in ride.pickup_points array)';

COMMENT ON COLUMN public.bookings.pickup_point_name IS 
'Denormalized pickup point name for quick display and WhatsApp notifications';

COMMENT ON COLUMN public.bookings.pickup_time IS 
'Calculated pickup time: ride.departure_time + pickup point time_offset_minutes';

-- Create index for pickup_time queries (useful for filtering by pickup time)
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_time ON public.bookings(pickup_time);
