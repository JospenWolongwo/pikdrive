-- Add verification code fields to bookings table
DO $$
BEGIN
    -- Add verification_code column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'verification_code'
    ) THEN
        ALTER TABLE public.bookings 
        ADD COLUMN verification_code VARCHAR(6);
    END IF;

    -- Add code_verified column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'code_verified'
    ) THEN
        ALTER TABLE public.bookings 
        ADD COLUMN code_verified BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add code_expiry column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'code_expiry'
    ) THEN
        ALTER TABLE public.bookings 
        ADD COLUMN code_expiry TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create function to generate a booking verification code
CREATE OR REPLACE FUNCTION generate_booking_verification_code(booking_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code VARCHAR(6);
  expiry_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Generate a random 6-digit code (letters and numbers)
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ceil(random() * 32)::integer, 1), '')
  INTO new_code
  FROM generate_series(1, 6);
  
  -- Set expiry time to 24 hours from now
  expiry_time := now() + interval '24 hours';
  
  -- Update booking with new code
  UPDATE public.bookings
  SET 
    verification_code = new_code,
    code_verified = FALSE,
    code_expiry = expiry_time
  WHERE id = booking_id
  AND (code_verified IS NULL OR code_verified = FALSE);
  
  RETURN new_code;
END;
$$;

-- Create function to verify a booking code
CREATE OR REPLACE FUNCTION verify_booking_code(booking_id UUID, submitted_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booking_record RECORD;
BEGIN
  -- Get the booking record
  SELECT * 
  INTO booking_record
  FROM public.bookings
  WHERE id = booking_id
  AND verification_code = submitted_code
  AND code_expiry > now()
  AND (code_verified IS NULL OR code_verified = FALSE);
  
  -- If no matching record found, return false
  IF booking_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Mark code as verified
  UPDATE public.bookings
  SET code_verified = TRUE
  WHERE id = booking_id;
  
  RETURN TRUE;
END;
$$;
