-- Create payment receipts table
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id uuid REFERENCES public.payments(id) NOT NULL,
    receipt_number varchar(50) NOT NULL,
    issued_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    pdf_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Add unique constraint on receipt number
CREATE UNIQUE INDEX payment_receipts_number_idx ON public.payment_receipts(receipt_number);

-- Enable RLS
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- Receipts policies
CREATE POLICY "Users can view their own receipts"
    ON public.payment_receipts
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT b.user_id 
            FROM public.bookings b
            JOIN public.payments p ON p.booking_id = b.id
            WHERE p.id = payment_receipts.payment_id
        )
    );

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS trigger AS $$
DECLARE
    year text;
    sequence_number text;
BEGIN
    year := to_char(CURRENT_DATE, 'YYYY');
    
    -- Get the next number in sequence for this year
    WITH RECURSIVE seq AS (
        SELECT 1 as num
        UNION ALL
        SELECT num + 1
        FROM seq
        WHERE num < 999999
    )
    SELECT LPAD(COALESCE(
        (SELECT num 
        FROM seq 
        WHERE num NOT IN (
            SELECT CAST(SUBSTRING(receipt_number FROM 6) AS INTEGER)
            FROM payment_receipts
            WHERE receipt_number LIKE 'RCP-' || year || '-%'
        )
        ORDER BY num
        LIMIT 1
    ), 1)::text, 6, '0') INTO sequence_number;
    
    -- Format: RCP-YYYY-XXXXXX
    NEW.receipt_number := 'RCP-' || year || '-' || sequence_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for receipt number generation
CREATE TRIGGER set_receipt_number
    BEFORE INSERT ON public.payment_receipts
    FOR EACH ROW
    EXECUTE FUNCTION generate_receipt_number();

-- Function to automatically create receipt after successful payment
CREATE OR REPLACE FUNCTION create_payment_receipt()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO public.payment_receipts (payment_id)
        VALUES (NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic receipt creation
CREATE TRIGGER create_receipt_after_payment
    AFTER UPDATE ON public.payments
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION create_payment_receipt();
