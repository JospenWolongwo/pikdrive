-- Persist destination drop-off point/name on booking for consistent notifications and dispute prevention.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS dropoff_point_name TEXT;

COMMENT ON COLUMN public.bookings.dropoff_point_name IS
'Passenger destination drop-off point/name captured at booking creation.';

-- Backfill existing bookings from ride destination city when available.
UPDATE public.bookings b
SET dropoff_point_name = r.to_city
FROM public.rides r
WHERE b.ride_id = r.id
  AND (b.dropoff_point_name IS NULL OR b.dropoff_point_name = '');
