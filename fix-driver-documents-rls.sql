-- Fix missing UPDATE policy for driver_documents
-- Add policy for drivers to update their own documents

-- Drop existing policies first
DROP POLICY IF EXISTS "Drivers can view their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Drivers can insert their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Drivers can update their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Admins can view all driver documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Admins can update driver documents" ON public.driver_documents;

-- Recreate all policies including the missing UPDATE policy
CREATE POLICY "Drivers can view their own documents" ON public.driver_documents
FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own documents" ON public.driver_documents
FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own documents" ON public.driver_documents
FOR UPDATE USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all driver documents" ON public.driver_documents
FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update driver documents" ON public.driver_documents
FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'driver_documents'; 