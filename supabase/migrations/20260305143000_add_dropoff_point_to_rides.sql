-- Persist driver-selected destination drop-off point on rides.

ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS dropoff_point_id UUID;

ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS dropoff_point_name TEXT;

COMMENT ON COLUMN public.rides.dropoff_point_id IS
'Destination drop-off point selected by driver (city_pickup_points.id in to_city).';

COMMENT ON COLUMN public.rides.dropoff_point_name IS
'Denormalized destination drop-off point name captured at ride creation/update.';

CREATE INDEX IF NOT EXISTS idx_rides_dropoff_point_id
ON public.rides(dropoff_point_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rides_dropoff_point_id_fkey'
  ) THEN
    ALTER TABLE public.rides
    ADD CONSTRAINT rides_dropoff_point_id_fkey
    FOREIGN KEY (dropoff_point_id)
    REFERENCES public.city_pickup_points(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill a readable value for existing rides.
UPDATE public.rides
SET dropoff_point_name = to_city
WHERE dropoff_point_name IS NULL OR dropoff_point_name = '';
