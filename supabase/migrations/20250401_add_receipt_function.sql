-- Function to get a receipt by payment ID
CREATE OR REPLACE FUNCTION get_receipt_by_payment_id(payment_id_param UUID)
RETURNS SETOF payment_receipts
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM payment_receipts
  WHERE payment_id = payment_id_param;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_receipt_by_payment_id(UUID) TO authenticated;
