-- Create the driver_documents storage bucket if it doesn't exist
BEGIN;
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'driver_documents',
    'driver_documents',
    TRUE,
    52428800, -- 50MB file size limit
    ARRAY[
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/pdf'
    ]
  )
  ON CONFLICT (id) DO NOTHING;

  -- Enable RLS on the storage.objects table if not already enabled
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

  -- Create policies directly on the storage.objects table
  -- Policy for authenticated users to upload files
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy 
      WHERE polname = 'Driver Document Upload Policy' 
      AND polrelid = 'storage.objects'::regclass
    ) THEN
      CREATE POLICY "Driver Document Upload Policy" 
      ON storage.objects FOR INSERT TO authenticated 
      WITH CHECK (bucket_id = 'driver_documents');
    END IF;

    -- Policy for authenticated users to read their own files
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy 
      WHERE polname = 'Driver Document Select Policy' 
      AND polrelid = 'storage.objects'::regclass
    ) THEN
      CREATE POLICY "Driver Document Select Policy" 
      ON storage.objects FOR SELECT TO authenticated 
      USING (bucket_id = 'driver_documents');
    END IF;
  END $$;
COMMIT;
