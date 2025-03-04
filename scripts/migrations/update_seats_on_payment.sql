-- Function to update available seats after successful payment
CREATE OR REPLACE FUNCTION public.update_seats_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the payment status changed to 'successful'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'successful' AND OLD.status != 'successful') THEN
    -- Get booking details
    WITH booking_details AS (
      SELECT b.ride_id, b.seats
      FROM public.bookings b
      WHERE b.id = NEW.booking_id
    )
    -- Update ride seats_available
    UPDATE public.rides r
    SET seats_available = seats_available - (
      SELECT seats FROM booking_details
    )
    WHERE r.id = (
      SELECT ride_id FROM booking_details
    );

    -- Update booking status to confirmed
    UPDATE public.bookings
    SET status = 'confirmed',
        payment_status = 'paid',
        updated_at = NOW()
    WHERE id = NEW.booking_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_seats_after_payment_trigger ON public.payments;

-- Create trigger
CREATE TRIGGER update_seats_after_payment_trigger
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_seats_after_payment();
