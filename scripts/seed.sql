-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.profiles(id),
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  price INTEGER NOT NULL,
  seats_available INTEGER NOT NULL,
  car_model TEXT,
  car_color TEXT,
  car_year TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id),
  user_id UUID REFERENCES public.profiles(id),
  seats INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Update storage bucket configuration
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'avatars';

-- If bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars');

-- Drop all existing policies first
DO $$ 
BEGIN
  -- Drop storage policies
  DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Avatar images can be updated by owner" ON storage.objects;
  DROP POLICY IF EXISTS "Avatar images can be deleted by owner" ON storage.objects;
  
  -- Drop profiles policies
  DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  
  -- Drop rides policies
  DROP POLICY IF EXISTS "Rides viewable by everyone" ON public.rides;
  DROP POLICY IF EXISTS "Users can create rides" ON public.rides;
  DROP POLICY IF EXISTS "Users can update own rides" ON public.rides;
  DROP POLICY IF EXISTS "Users can delete own rides" ON public.rides;
  
  -- Drop bookings policies
  DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload an avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (
    name ILIKE '%.jpg' OR 
    name ILIKE '%.jpeg' OR 
    name ILIKE '%.png' OR 
    name ILIKE '%.gif' OR 
    name ILIKE '%.webp'
  )
);

CREATE POLICY "Avatar images can be updated by owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar images can be deleted by owner"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create table policies
CREATE POLICY "Profiles viewable by everyone"
  ON public.profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Rides viewable by everyone"
  ON public.rides FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create rides"
  ON public.rides FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own rides"
  ON public.rides FOR UPDATE
  TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Users can delete own rides"
  ON public.rides FOR DELETE
  TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Insert current user's profile
INSERT INTO public.profiles (id, full_name, email, phone, city, created_at, updated_at)
VALUES 
  ('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Current User', 'user@example.com', '237698805890', 'Douala', NOW(), NOW())
ON CONFLICT (id) DO UPDATE 
SET full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city;

-- Insert test rides using current user as driver
INSERT INTO public.rides (
  driver_id,
  from_city,
  to_city,
  departure_time,
  price,
  seats_available,
  car_model,
  car_color,
  car_year
) VALUES 
  ('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Yaoundé', NOW() + interval '1 day', 5000, 3, 'Toyota Corolla', 'Black', '2020'),
  ('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Yaoundé', 'Douala', NOW() + interval '2 days', 5000, 4, 'Toyota Corolla', 'Black', '2020')
ON CONFLICT DO NOTHING;
