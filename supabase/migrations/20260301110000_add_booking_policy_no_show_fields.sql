-- Add additive booking policy/no-show fields without changing booking status constraint.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS no_show_marked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS no_show_marked_by UUID,
ADD COLUMN IF NOT EXISTS no_show_contact_attempted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS no_show_note TEXT;

COMMENT ON COLUMN public.bookings.no_show_marked_at IS
  'Timestamp when a driver recorded this booking as not taken at pickup time. V1 keeps booking status enum unchanged.';

COMMENT ON COLUMN public.bookings.no_show_marked_by IS
  'Driver profile id that recorded the booking as no-show. V1 uses additive metadata instead of a new booking status.';

COMMENT ON COLUMN public.bookings.no_show_contact_attempted IS
  'Whether the driver confirmed they attempted to contact the passenger before marking no-show.';

COMMENT ON COLUMN public.bookings.no_show_note IS
  'Optional driver note captured when recording a no-show. Intended for lightweight ops/audit context.';

