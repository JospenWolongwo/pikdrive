-- Create storage bucket for passenger documents
-- Date: 2025-01-01

BEGIN;
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'passenger-documents',
    'passenger-documents',
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


  -- Create policies directly on the storage.objects table
  -- Policy for authenticated users to upload their own passenger documents
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy 
      WHERE polname = 'Passenger Document Upload Policy' 
      AND polrelid = 'storage.objects'::regclass
    ) THEN
      CREATE POLICY "Passenger Document Upload Policy" 
      ON storage.objects FOR INSERT TO authenticated 
      WITH CHECK (
        bucket_id = 'passenger-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
    END IF;

    -- Policy for authenticated users to read their own passenger documents
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy 
      WHERE polname = 'Passenger Document Select Own Policy' 
      AND polrelid = 'storage.objects'::regclass
    ) THEN
      CREATE POLICY "Passenger Document Select Own Policy" 
      ON storage.objects FOR SELECT TO authenticated 
      USING (
        bucket_id = 'passenger-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
    END IF;

    -- Policy for admins to view all passenger documents
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy 
      WHERE polname = 'Passenger Document Admin Select Policy' 
      AND polrelid = 'storage.objects'::regclass
    ) THEN
      CREATE POLICY "Passenger Document Admin Select Policy" 
      ON storage.objects FOR SELECT TO authenticated 
      USING (
        bucket_id = 'passenger-documents' AND
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
    END IF;
  END $$;
COMMIT;

