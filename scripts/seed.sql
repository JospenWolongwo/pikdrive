-- Alter existing tables to ensure they have all required columns
DO $$ 
BEGIN
  -- Add columns to profiles if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_driver') THEN
    ALTER TABLE public.profiles ADD COLUMN is_driver BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'driver_status') THEN
    ALTER TABLE public.profiles ADD COLUMN driver_status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;

  -- Add timestamps if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Create driver_documents table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_documents') THEN
    CREATE TABLE public.driver_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id UUID REFERENCES public.profiles(id),
      national_id_number TEXT NOT NULL,
      license_number TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      insurance_number TEXT NOT NULL,
      road_tax_number TEXT NOT NULL,
      technical_inspection_number TEXT NOT NULL,
      vehicle_images TEXT[], -- Array of image URLs
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;

  -- Create rides table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides') THEN
    CREATE TABLE public.rides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id UUID REFERENCES public.profiles(id),
      from_city TEXT NOT NULL,
      to_city TEXT NOT NULL,
      departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
      price INTEGER NOT NULL,
      seats_available INTEGER NOT NULL,
      total_seats INTEGER NOT NULL,
      car_model TEXT,
      car_color TEXT,
      car_year TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;

  -- Create bookings table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    CREATE TABLE public.bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_id UUID REFERENCES public.rides(id),
      user_id UUID REFERENCES public.profiles(id),
      seats INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;

  -- Create messages table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    CREATE TABLE public.messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_id UUID REFERENCES public.rides(id),
      sender_id UUID REFERENCES public.profiles(id),
      receiver_id UUID REFERENCES public.profiles(id),
      content TEXT NOT NULL,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;

END $$;

-- Add total_seats column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'total_seats') THEN
    ALTER TABLE public.rides ADD COLUMN total_seats INTEGER;
    -- Set total_seats equal to seats_available for existing rides
    UPDATE public.rides SET total_seats = seats_available WHERE total_seats IS NULL;
    -- Make total_seats NOT NULL after setting initial values
    ALTER TABLE public.rides ALTER COLUMN total_seats SET NOT NULL;
  END IF;
END $$;

-- Enable RLS
DO $$ 
BEGIN
  -- Enable RLS on all tables
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Drop existing policies
DO $$ 
BEGIN
  -- Drop table policies
  EXECUTE 'DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Drivers can view their own documents" ON public.driver_documents';
  EXECUTE 'DROP POLICY IF EXISTS "Drivers can insert their own documents" ON public.driver_documents';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can view all driver documents" ON public.driver_documents';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can update driver documents" ON public.driver_documents';
  EXECUTE 'DROP POLICY IF EXISTS "Rides are viewable by everyone" ON public.rides';
  EXECUTE 'DROP POLICY IF EXISTS "Drivers can create rides" ON public.rides';
  EXECUTE 'DROP POLICY IF EXISTS "Drivers can update their own rides" ON public.rides';
  EXECUTE 'DROP POLICY IF EXISTS "Drivers can delete their own rides" ON public.rides';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS "Users can send messages" ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings';
  EXECUTE 'DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles';

  -- Drop storage policies
  EXECUTE 'DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Vehicle images are publicly accessible" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Drivers can upload vehicle images" ON storage.objects';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Update storage bucket configuration
DO $$ 
BEGIN
  -- Create or update avatars bucket
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  ON CONFLICT (id) DO UPDATE 
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  -- Create or update vehicles bucket
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('vehicles', 'vehicles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  ON CONFLICT (id) DO UPDATE 
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
END $$;

-- Create policies
DO $$ 
BEGIN
  -- Create profile policies
  EXECUTE 'CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true)';
  EXECUTE 'CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id)';
  EXECUTE 'CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (auth.jwt() ->> ''role'' = ''admin'')';
  EXECUTE 'CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (auth.jwt() ->> ''role'' = ''admin'')';

  -- Create driver document policies
  EXECUTE 'CREATE POLICY "Drivers can view their own documents" ON public.driver_documents FOR SELECT USING (auth.uid() = driver_id)';
  EXECUTE 'CREATE POLICY "Drivers can insert their own documents" ON public.driver_documents FOR INSERT WITH CHECK (auth.uid() = driver_id)';
  EXECUTE 'CREATE POLICY "Admins can view all driver documents" ON public.driver_documents FOR SELECT USING (auth.jwt() ->> ''role'' = ''admin'')';
  EXECUTE 'CREATE POLICY "Admins can update driver documents" ON public.driver_documents FOR UPDATE USING (auth.jwt() ->> ''role'' = ''admin'')';

  -- Create ride policies
  EXECUTE 'CREATE POLICY "Rides are viewable by everyone" ON public.rides FOR SELECT USING (true)';
  EXECUTE 'CREATE POLICY "Drivers can create rides" ON public.rides FOR INSERT WITH CHECK (auth.uid() = driver_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_driver = true AND driver_status = ''approved''))';
  EXECUTE 'CREATE POLICY "Drivers can update their own rides" ON public.rides FOR UPDATE USING (auth.uid() = driver_id)';
  EXECUTE 'CREATE POLICY "Drivers can delete their own rides" ON public.rides FOR DELETE USING (auth.uid() = driver_id)';

  -- Create message policies
  EXECUTE 'CREATE POLICY "Users can view messages they sent or received" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id)';
  EXECUTE 'CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id)';

  -- Create booking policies
  EXECUTE 'CREATE POLICY "Users can view their own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id)';

  -- Create storage policies
  EXECUTE 'CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = ''avatars'')';
  EXECUTE 'CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''avatars'' AND auth.uid()::text = (storage.foldername(name))[1])';
  EXECUTE 'CREATE POLICY "Vehicle images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = ''vehicles'')';
  EXECUTE 'CREATE POLICY "Drivers can upload vehicle images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''vehicles'' AND auth.uid()::text = (storage.foldername(name))[1])';

  -- Create storage bucket for avatars if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('avatars', 'avatars', true);
  END IF;

  -- Allow authenticated users to upload avatars
  EXECUTE 'CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT
    USING ( bucket_id = ''avatars'' )';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'CREATE POLICY "Anyone can upload an avatar"
    ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = ''avatars'' )';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'CREATE POLICY "Anyone can update their own avatar"
    ON storage.objects FOR UPDATE
    USING ( auth.uid()::text = (storage.foldername(name))[1] )';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'CREATE POLICY "Anyone can delete their own avatar"
    ON storage.objects FOR DELETE
    USING ( auth.uid()::text = (storage.foldername(name))[1] )';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
