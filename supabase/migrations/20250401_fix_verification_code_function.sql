-- Fix the verification code generation function to properly return the code
CREATE OR REPLACE FUNCTION generate_booking_verification_code(booking_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code VARCHAR(6);
  expiry_time TIMESTAMP WITH TIME ZONE;
  affected_rows INTEGER;
BEGIN
  -- Generate a random 6-digit code (letters and numbers)
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ceil(random() * 32)::integer, 1), '')
  INTO new_code
  FROM generate_series(1, 6);
  
  -- Set expiry time to 24 hours from now
  expiry_time := now() + interval '24 hours';
  
  -- Log generated code for debugging
  RAISE NOTICE 'Generated code % for booking %', new_code, booking_id;
  
  -- Update booking with new code and get affected row count
  WITH updated AS (
    UPDATE public.bookings
    SET 
      verification_code = new_code,
      code_verified = FALSE,
      code_expiry = expiry_time,
      updated_at = now()
    WHERE id = booking_id
    RETURNING id
  )
  SELECT count(*) INTO affected_rows FROM updated;
  
  -- Check if update was successful
  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Failed to update booking % with verification code', booking_id;
  END IF;
  
  -- Return the generated code
  RETURN new_code;
END;
$$;

-- Add function to fetch the current verification code for a booking
CREATE OR REPLACE FUNCTION get_booking_verification_code(booking_id UUID)
RETURNS TABLE(
  verification_code VARCHAR,
  code_expiry TIMESTAMP WITH TIME ZONE,
  code_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT b.verification_code, b.code_expiry, b.code_verified
  FROM public.bookings b
  WHERE b.id = booking_id;
END;
$$;
