-- Create booking_status enum
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id uuid REFERENCES public.rides(id),
    user_id uuid REFERENCES auth.users(id),
    seats integer NOT NULL CHECK (seats > 0),
    status booking_status DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Add RLS policies
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Bookings policies
CREATE POLICY "Users can view their own bookings"
    ON public.bookings
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookings"
    ON public.bookings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings"
    ON public.bookings
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX bookings_user_id_idx ON public.bookings(user_id);
CREATE INDEX bookings_ride_id_idx ON public.bookings(ride_id);
