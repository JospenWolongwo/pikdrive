-- Fix permissions for payments table
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

-- Policy for users to select their own payments
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments" ON public.payments
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM bookings WHERE user_id = auth.uid()
    )
  );

-- Grant API service role access to handle payment operations
GRANT ALL ON public.payments TO service_role;

-- Add proper CORS settings (this will be applied by Supabase)
COMMENT ON SCHEMA public IS '
{"cors_rules": [
  {
    "origin": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    "headers": ["*"],
    "credentials": true
  }
]}
';
