-- Create enums if they don't exist
DO $$ 
BEGIN
    -- Create payment_provider enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
        CREATE TYPE payment_provider AS ENUM ('mtn', 'orange');
    END IF;

    -- Create payment_status enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
    END IF;
END $$;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id uuid REFERENCES public.bookings(id),
    amount decimal(10,2) NOT NULL,
    currency varchar(10) DEFAULT 'XAF',
    status payment_status DEFAULT 'pending',
    provider payment_provider,
    transaction_id varchar(100),
    phone_number varchar(20),
    payment_time timestamp with time zone,
    metadata jsonb DEFAULT '{}',
    error_message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Add payment status to bookings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE public.bookings 
        ADD COLUMN payment_status payment_status DEFAULT 'pending';
    END IF;
END $$;

-- Create payment_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.payment_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id uuid REFERENCES public.payments(id),
    event_type varchar(50) NOT NULL,
    event_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and add policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can create payments for their own bookings" ON public.payments;

-- Create new RLS policies
CREATE POLICY "Enable all access for authenticated users" 
ON public.payments
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS payments_booking_id_idx ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_transaction_id_idx ON public.payments(transaction_id);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
