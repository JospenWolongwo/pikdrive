-- Create RPC function for setting up bucket policies from server-side code
-- This allows the API to create policies without direct SQL access

-- Function to create storage policies for a given bucket
CREATE OR REPLACE FUNCTION create_storage_policies(bucket_id TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create policy to allow authenticated users to upload their own files
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'authenticated-can-upload-' || bucket_id,
      jsonb_build_object(
        'role', 'authenticated',
        'operation', 'INSERT',
        'check', '(bucket_id = ''' || bucket_id || ''') AND (auth.uid() = storage.foldername(name))'::text
      ),
      bucket_id
    )
    ON CONFLICT (name, bucket_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating upload policy for %: %', bucket_id, SQLERRM;
  END;

  -- Create policy to allow authenticated users to view files
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'authenticated-can-read-' || bucket_id,
      jsonb_build_object(
        'role', 'authenticated',
        'operation', 'SELECT',
        'check', '(bucket_id = ''' || bucket_id || ''') AND (auth.uid() IS NOT NULL)'::text
      ),
      bucket_id
    )
    ON CONFLICT (name, bucket_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating read policy for %: %', bucket_id, SQLERRM;
  END;

  -- Create policy to allow authenticated users to update their own files
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'authenticated-can-update-' || bucket_id,
      jsonb_build_object(
        'role', 'authenticated',
        'operation', 'UPDATE',
        'check', '(bucket_id = ''' || bucket_id || ''') AND (auth.uid() = storage.foldername(name))'::text
      ),
      bucket_id
    )
    ON CONFLICT (name, bucket_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating update policy for %: %', bucket_id, SQLERRM;
  END;
  
  RETURN TRUE;
END;
$$;

-- Also create vehicle-specific policies
CREATE OR REPLACE FUNCTION setup_vehicle_storage()
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  vehicle_bucket_exists BOOLEAN;
BEGIN
  -- Check if the vehicles bucket exists
  SELECT EXISTS(
    SELECT 1 FROM storage.buckets WHERE name = 'vehicles'
  ) INTO vehicle_bucket_exists;
  
  -- Create the bucket if it doesn't exist
  IF NOT vehicle_bucket_exists THEN
    INSERT INTO storage.buckets (id, name)
    VALUES ('vehicles', 'vehicles');
  END IF;
  
  -- Apply policies to vehicles bucket
  PERFORM create_storage_policies('vehicles');
  
  RETURN TRUE;
END;
$$;

-- Run the setup
SELECT setup_vehicle_storage();
