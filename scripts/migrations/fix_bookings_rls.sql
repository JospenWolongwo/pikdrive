-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;

-- Create updated policies
CREATE POLICY "Enable read access for authenticated users"
    ON public.bookings
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users"
    ON public.bookings
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

CREATE POLICY "Enable update for users based on user_id"
    ON public.bookings
    FOR UPDATE
    USING (auth.uid() = user_id);
