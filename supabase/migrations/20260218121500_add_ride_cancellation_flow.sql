-- ============================================================================
-- Ride Cancellation Flow
-- ============================================================================
-- Adds ride-level cancellation state and prevents bookings on cancelled rides.
-- ============================================================================

-- Add ride cancellation state columns
ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS cancelled_by UUID;

ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

UPDATE public.rides
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.rides
ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rides_status_check'
  ) THEN
    ALTER TABLE public.rides
    ADD CONSTRAINT rides_status_check
    CHECK (status IN ('active', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rides_cancelled_by_fkey'
  ) THEN
    ALTER TABLE public.rides
    ADD CONSTRAINT rides_cancelled_by_fkey
    FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON public.rides(driver_id, status);

COMMENT ON COLUMN public.rides.status IS 'Ride lifecycle status: active or cancelled';
COMMENT ON COLUMN public.rides.cancelled_at IS 'Timestamp when driver cancelled the ride';
COMMENT ON COLUMN public.rides.cancelled_by IS 'Driver who cancelled the ride';
COMMENT ON COLUMN public.rides.cancellation_reason IS 'Optional reason provided by driver when cancelling';

-- Prevent creating/reactivating bookings on cancelled rides
CREATE OR REPLACE FUNCTION public.ensure_ride_is_bookable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ride_status TEXT;
BEGIN
  -- Cancellation/terminal updates are allowed.
  IF NEW.status IN ('cancelled', 'completed', 'expired') THEN
    RETURN NEW;
  END IF;

  SELECT status
  INTO v_ride_status
  FROM public.rides
  WHERE id = NEW.ride_id;

  IF v_ride_status IS NULL THEN
    RAISE EXCEPTION 'Ride not found: %', NEW.ride_id;
  END IF;

  IF v_ride_status = 'cancelled' THEN
    RAISE EXCEPTION 'This ride has been cancelled by the driver';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_ride_is_bookable ON public.bookings;

CREATE TRIGGER trg_ensure_ride_is_bookable
BEFORE INSERT OR UPDATE OF ride_id, status
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.ensure_ride_is_bookable();

