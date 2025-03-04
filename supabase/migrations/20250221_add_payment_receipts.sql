-- Create payment receipts table
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id uuid REFERENCES public.payments(id) NOT NULL,
    receipt_number varchar(50) NOT NULL DEFAULT '',
    issued_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    pdf_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Drop existing constraints and indexes
DROP INDEX IF EXISTS payment_receipts_number_idx;
ALTER TABLE IF EXISTS public.payment_receipts DROP CONSTRAINT IF EXISTS receipt_number_unique;
ALTER TABLE IF EXISTS public.payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_receipt_number_key;
ALTER TABLE IF EXISTS public.payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_payment_id_key;

-- Clean up duplicate receipts - keep only the latest one for each payment
DELETE FROM public.payment_receipts a
    USING public.payment_receipts b
    WHERE a.payment_id = b.payment_id 
    AND a.created_at < b.created_at;

-- Clean up orphaned receipts (where payment doesn't exist)
DELETE FROM public.payment_receipts a
    WHERE NOT EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.id = a.payment_id
    );

-- Clean up receipts with empty or duplicate receipt numbers
DELETE FROM public.payment_receipts
WHERE receipt_number = '';

WITH duplicates AS (
    SELECT receipt_number
    FROM public.payment_receipts
    WHERE receipt_number != ''
    GROUP BY receipt_number
    HAVING COUNT(*) > 1
)
DELETE FROM public.payment_receipts a
USING duplicates d
WHERE a.receipt_number = d.receipt_number;

-- Add unique constraints
ALTER TABLE public.payment_receipts ADD CONSTRAINT receipt_number_unique UNIQUE (receipt_number);
ALTER TABLE public.payment_receipts ADD CONSTRAINT payment_receipts_payment_id_key UNIQUE (payment_id);

-- Enable RLS
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own receipts" ON public.payment_receipts;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.payment_receipts;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.payment_receipts;

-- Create new policies
CREATE POLICY "Enable all access for authenticated users"
    ON public.payment_receipts
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create a sequence for receipt numbers
DROP SEQUENCE IF EXISTS receipt_number_seq;
CREATE SEQUENCE receipt_number_seq START 1;

-- Drop old triggers and functions first
DROP TRIGGER IF EXISTS set_receipt_number ON public.payment_receipts;
DROP TRIGGER IF EXISTS create_receipt_on_payment_complete ON public.payments;
DROP FUNCTION IF EXISTS public.create_payment_receipt();
DROP FUNCTION IF EXISTS public.generate_receipt_number();

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    next_val text;
    receipt_num text;
    max_attempts integer := 3;
    current_attempt integer := 0;
BEGIN
    WHILE current_attempt < max_attempts LOOP
        BEGIN
            -- Get next value from sequence
            SELECT nextval('receipt_number_seq') INTO next_val;
            
            -- Format: RECEIPT-YYYY-NNNNN
            receipt_num := 'RECEIPT-' || 
                       to_char(CURRENT_TIMESTAMP, 'YYYY') || '-' ||
                       LPAD(next_val::text, 5, '0');
            
            -- Check if this number is already used
            IF NOT EXISTS (
                SELECT 1 
                FROM public.payment_receipts 
                WHERE receipt_number = receipt_num
            ) THEN
                RETURN receipt_num;
            END IF;
            
            current_attempt := current_attempt + 1;
        END;
    END LOOP;
    
    RAISE EXCEPTION 'Failed to generate unique receipt number after % attempts', max_attempts;
END;
$function$;

-- Function to create receipt
CREATE OR REPLACE FUNCTION public.create_receipt(payment_id_param uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
    new_receipt_id uuid;
    new_receipt_number text;
BEGIN
    -- Generate a new receipt number
    new_receipt_number := public.generate_receipt_number();
    
    -- Insert the new receipt
    INSERT INTO public.payment_receipts (
        payment_id,
        receipt_number,
        issued_at
    )
    VALUES (
        payment_id_param,
        new_receipt_number,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (payment_id) DO UPDATE
    SET receipt_number = EXCLUDED.receipt_number,
        issued_at = EXCLUDED.issued_at
    RETURNING id INTO new_receipt_id;
    
    RETURN new_receipt_id;
END;
$function$;
