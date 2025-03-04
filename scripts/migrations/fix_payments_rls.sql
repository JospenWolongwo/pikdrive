-- Drop existing RLS policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."payments";
DROP POLICY IF EXISTS "Enable insert access for service role" ON "public"."payments";
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON "public"."payments";
DROP POLICY IF EXISTS "Enable insert for service role" ON "public"."payments";
DROP POLICY IF EXISTS "Enable read access for own payments" ON "public"."payments";
DROP POLICY IF EXISTS "Enable update for service role" ON "public"."payments";

-- Create new RLS policies
ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (for testing)
CREATE POLICY "Enable all access for authenticated users" 
ON "public"."payments"
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
