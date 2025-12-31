-- Create storage buckets for UAT
-- This migration ensures all required storage buckets exist (matching DEV configuration)

-- Create avatars bucket (for profile images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Create driver_documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver_documents',
  'driver_documents',
  true,
  52428800, -- 50MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

-- Create passenger-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'passenger-documents',
  'passenger-documents',
  true,
  52428800, -- 50MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

-- Create vehicles bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicles',
  'vehicles',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Note: RLS on storage.objects is managed by Supabase and should already be enabled
-- If RLS is not enabled, it must be enabled via Supabase Dashboard → Storage → Policies

-- Policy: Authenticated users can upload to avatars
DROP POLICY IF EXISTS "Authenticated users can upload to avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload to avatars" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

-- Policy: Anyone can view avatars
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'avatars');

-- Policy: Users can update their own avatars
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can delete their own avatars
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Authenticated users can upload to driver_documents
DROP POLICY IF EXISTS "Authenticated users can upload to driver_documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload to driver_documents" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'driver_documents');

-- Policy: Anyone can view driver_documents
DROP POLICY IF EXISTS "Anyone can view driver_documents" ON storage.objects;
CREATE POLICY "Anyone can view driver_documents" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'driver_documents');

-- Policy: Users can update their own driver_documents
DROP POLICY IF EXISTS "Users can update their own driver_documents" ON storage.objects;
CREATE POLICY "Users can update their own driver_documents" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'driver_documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'driver_documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can delete their own driver_documents
DROP POLICY IF EXISTS "Users can delete their own driver_documents" ON storage.objects;
CREATE POLICY "Users can delete their own driver_documents" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'driver_documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Authenticated users can upload to passenger-documents
DROP POLICY IF EXISTS "Authenticated users can upload to passenger-documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload to passenger-documents" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'passenger-documents');

-- Policy: Anyone can view passenger-documents
DROP POLICY IF EXISTS "Anyone can view passenger-documents" ON storage.objects;
CREATE POLICY "Anyone can view passenger-documents" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'passenger-documents');

-- Policy: Users can update their own passenger-documents
DROP POLICY IF EXISTS "Users can update their own passenger-documents" ON storage.objects;
CREATE POLICY "Users can update their own passenger-documents" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'passenger-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'passenger-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can delete their own passenger-documents
DROP POLICY IF EXISTS "Users can delete their own passenger-documents" ON storage.objects;
CREATE POLICY "Users can delete their own passenger-documents" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'passenger-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Authenticated users can upload to vehicles
DROP POLICY IF EXISTS "Authenticated users can upload to vehicles" ON storage.objects;
CREATE POLICY "Authenticated users can upload to vehicles" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'vehicles');

-- Policy: Anyone can view vehicles
DROP POLICY IF EXISTS "Anyone can view vehicles" ON storage.objects;
CREATE POLICY "Anyone can view vehicles" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'vehicles');

-- Policy: Users can update their own vehicles
DROP POLICY IF EXISTS "Users can update their own vehicles" ON storage.objects;
CREATE POLICY "Users can update their own vehicles" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'vehicles' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'vehicles' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can delete their own vehicles
DROP POLICY IF EXISTS "Users can delete their own vehicles" ON storage.objects;
CREATE POLICY "Users can delete their own vehicles" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'vehicles' AND (storage.foldername(name))[1] = auth.uid()::text);

