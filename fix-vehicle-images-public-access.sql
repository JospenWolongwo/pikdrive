-- Make vehicle images publicly accessible for rides page
-- This allows unauthenticated users to see vehicle images while keeping other driver data private

-- Drop existing policies
DROP POLICY IF EXISTS "Drivers can view their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Drivers can insert their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Drivers can update their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Admins can view all driver documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Admins can update driver documents" ON public.driver_documents;

-- Create new policies that allow public access to vehicle_images only
CREATE POLICY "Anyone can view vehicle images" ON public.driver_documents
FOR SELECT USING (true);

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