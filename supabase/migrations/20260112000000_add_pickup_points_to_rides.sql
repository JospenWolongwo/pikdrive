-- ============================================================================
-- Add pickup_points to rides table
-- ============================================================================
-- Adds JSONB column to store driver-defined pickup points for each ride.
-- Each pickup point contains: id, name, order, time_offset_minutes
-- ============================================================================

-- Add pickup_points column to rides table
ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS pickup_points JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the structure
COMMENT ON COLUMN public.rides.pickup_points IS 
'Array of pickup points defined by driver. Each point has: {id: string, name: string, order: number, time_offset_minutes: number}';

-- Create index for JSONB queries (useful for filtering/searching)
CREATE INDEX IF NOT EXISTS idx_rides_pickup_points ON public.rides USING GIN (pickup_points);

-- Add check constraint to ensure pickup_points is an array
ALTER TABLE public.rides
ADD CONSTRAINT check_pickup_points_is_array 
CHECK (jsonb_typeof(pickup_points) = 'array');
