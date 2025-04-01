-- Fix permissions for bookings table
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own bookings
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
CREATE POLICY "Users can view their own bookings" ON public.bookings
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT driver_id FROM rides WHERE id = ride_id
    )
  );

-- Allow booking code generation and verification functions to work
GRANT EXECUTE ON FUNCTION generate_booking_verification_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_booking_code(UUID, VARCHAR) TO authenticated;

-- Ensure the payment_receipts functions have proper permissions
DROP POLICY IF EXISTS "Users can view their own receipts" ON public.payment_receipts;
CREATE POLICY "Users can view their own receipts" ON public.payment_receipts
  FOR SELECT USING (
    payment_id IN (
      SELECT p.id FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

-- Ensure all relevant tables have RLS enabled
ALTER TABLE IF EXISTS public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- Fix any issues with the create_receipt function
DROP FUNCTION IF EXISTS create_receipt;
CREATE OR REPLACE FUNCTION create_receipt(payment_id_param UUID)
RETURNS SETOF payment_receipts
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Check if receipt already exists
  IF EXISTS (SELECT 1 FROM payment_receipts WHERE payment_id = payment_id_param) THEN
    RETURN QUERY SELECT * FROM payment_receipts WHERE payment_id = payment_id_param;
    RETURN;
  END IF;
  
  -- Create new receipt
  RETURN QUERY
  INSERT INTO payment_receipts (
    payment_id,
    receipt_number,
    issued_at,
    created_at,
    updated_at
  )
  SELECT
    payment_id_param,
    'RECEIPT-' || to_char(now(), 'YYYY') || '-' || LPAD(CAST(nextval('receipt_number_seq') AS TEXT), 5, '0'),
    now(),
    now(),
    now()
  FROM payments
  WHERE id = payment_id_param
  RETURNING *;
END;
$$;
