-- Create payment_providers enum
CREATE TYPE payment_provider AS ENUM ('mtn', 'orange');

-- Create payment_status enum
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- Create payments table
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

-- Add payment status to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending';

-- Create payment_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.payment_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id uuid REFERENCES public.payments(id),
    event_type varchar(50) NOT NULL,
    event_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Create payment_receipts table
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id uuid REFERENCES public.payments(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Add RLS policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY "Users can view their own payments"
    ON public.payments
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id 
            FROM public.bookings 
            WHERE id = payments.booking_id
        )
    );

CREATE POLICY "Users can create payments for their own bookings"
    ON public.payments
    FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id 
            FROM public.bookings 
            WHERE id = booking_id
        )
    );

-- Payment logs policies
CREATE POLICY "Users can view their own payment logs"
    ON public.payment_logs
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT b.user_id 
            FROM public.bookings b
            JOIN public.payments p ON p.booking_id = b.id
            WHERE p.id = payment_id
        )
    );

-- Payment receipts policies
CREATE POLICY "Users can view their own payment receipts"
    ON public.payment_receipts
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT b.user_id 
            FROM public.bookings b
            JOIN public.payments p ON p.booking_id = b.id
            WHERE p.id = payment_id
        )
    );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS payments_booking_id_idx ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_transaction_id_idx ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS payment_logs_payment_id_idx ON public.payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS payment_receipts_payment_id_idx ON public.payment_receipts(payment_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for payments table
CREATE TRIGGER set_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create function to log payment events
CREATE OR REPLACE FUNCTION public.log_payment_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.payment_logs (payment_id, event_type, event_data)
    VALUES (
        NEW.id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'payment_created'
            WHEN TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN 'status_changed'
            ELSE 'payment_updated'
        END,
        jsonb_build_object(
            'old_data', to_jsonb(OLD),
            'new_data', to_jsonb(NEW),
            'changed_by', auth.uid()
        )
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for payment logging
CREATE TRIGGER log_payment_changes
    AFTER INSERT OR UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.log_payment_event();
