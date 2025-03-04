-- Drop existing RLS policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."payment_logs";
DROP POLICY IF EXISTS "Enable insert access for service role" ON "public"."payment_logs";
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON "public"."payment_logs";
DROP POLICY IF EXISTS "Enable insert for service role" ON "public"."payment_logs";
DROP POLICY IF EXISTS "Enable read access for own payments" ON "public"."payment_logs";
DROP POLICY IF EXISTS "Enable update for service role" ON "public"."payment_logs";
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."payment_logs";
DROP POLICY IF EXISTS "Users can view their own payment logs" ON "public"."payment_logs";
DROP POLICY IF EXISTS "Allow trigger to insert logs" ON "public"."payment_logs";

-- Enable RLS
ALTER TABLE "public"."payment_logs" ENABLE ROW LEVEL SECURITY;

-- Allow trigger to insert logs
CREATE POLICY "Allow trigger to insert logs"
ON "public"."payment_logs"
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to view their own payment logs
CREATE POLICY "Users can view their own payment logs"
ON "public"."payment_logs"
FOR SELECT
TO authenticated
USING (
    auth.uid() IN (
        SELECT b.user_id 
        FROM public.bookings b
        JOIN public.payments p ON p.booking_id = b.id
        WHERE p.id = payment_id
    )
);
