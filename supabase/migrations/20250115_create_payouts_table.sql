-- Create payouts table for tracking driver payouts
-- This table stores payout records when drivers verify booking codes

-- Create payout_status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
    END IF;
END $$;

-- Create payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    
    -- Amount details
    amount decimal(10,2) NOT NULL CHECK (amount >= 0), -- driver earnings after fees
    original_amount decimal(10,2) NOT NULL CHECK (original_amount >= 0), -- original payment amount
    transaction_fee decimal(10,2) NOT NULL DEFAULT 0 CHECK (transaction_fee >= 0),
    commission decimal(10,2) NOT NULL DEFAULT 0 CHECK (commission >= 0),
    currency varchar(10) DEFAULT 'XAF',
    
    -- Provider information
    provider varchar(20) NOT NULL CHECK (provider IN ('mtn', 'orange')),
    phone_number varchar(20) NOT NULL,
    transaction_id varchar(100), -- provider transaction ID
    
    -- Status and metadata
    status payout_status DEFAULT 'pending',
    reason text,
    metadata jsonb DEFAULT '{}',
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS payouts_driver_id_idx ON public.payouts(driver_id);
CREATE INDEX IF NOT EXISTS payouts_booking_id_idx ON public.payouts(booking_id);
CREATE INDEX IF NOT EXISTS payouts_payment_id_idx ON public.payouts(payment_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON public.payouts(status);
CREATE INDEX IF NOT EXISTS payouts_created_at_idx ON public.payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS payouts_transaction_id_idx ON public.payouts(transaction_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_payouts_updated_at
    BEFORE UPDATE ON public.payouts
    FOR EACH ROW
    EXECUTE FUNCTION update_payouts_updated_at();

-- Enable RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Drivers can view their own payouts" ON public.payouts;
DROP POLICY IF EXISTS "System can insert payouts" ON public.payouts;
DROP POLICY IF EXISTS "System can update payouts" ON public.payouts;

-- Create RLS policies
-- Drivers can view their own payouts
CREATE POLICY "Drivers can view their own payouts" 
ON public.payouts
FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

-- System can insert payouts (via service role or authenticated users creating their own)
CREATE POLICY "System can insert payouts" 
ON public.payouts
FOR INSERT
TO authenticated
WITH CHECK (driver_id = auth.uid());

-- System can update payouts (via service role for callbacks)
-- Note: In production, you may want to restrict this to service role only
CREATE POLICY "System can update payouts" 
ON public.payouts
FOR UPDATE
TO authenticated
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

-- Add comment to table
COMMENT ON TABLE public.payouts IS 'Tracks driver payouts when booking codes are verified';
COMMENT ON COLUMN public.payouts.amount IS 'Driver earnings after fees and commission';
COMMENT ON COLUMN public.payouts.original_amount IS 'Original passenger payment amount';
COMMENT ON COLUMN public.payouts.transaction_fee IS 'Transaction fee deducted';
COMMENT ON COLUMN public.payouts.commission IS 'Platform commission deducted';
COMMENT ON COLUMN public.payouts.transaction_id IS 'Provider transaction ID (MTN MoMo or Orange Money)';

