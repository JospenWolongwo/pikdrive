-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email_notifications boolean DEFAULT true,
    sms_notifications boolean DEFAULT true,
    whatsapp_notifications boolean DEFAULT true,
    language varchar(10) DEFAULT 'en',
    phone_number varchar(20),
    timezone varchar(50) DEFAULT 'Africa/Douala',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own settings
CREATE POLICY "Users can view their own settings"
    ON public.user_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy to allow users to update their own settings
CREATE POLICY "Users can update their own settings"
    ON public.user_settings
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy to allow users to insert their own settings
CREATE POLICY "Users can insert their own settings"
    ON public.user_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
