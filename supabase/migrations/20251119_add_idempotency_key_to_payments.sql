-- Add idempotency_key column to payments table
-- This column is used to prevent duplicate payment processing
-- Reference: docs/DATABASE_SCHEMA.md line 268

-- Add the idempotency_key column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'payments' 
        AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.payments 
        ADD COLUMN idempotency_key TEXT UNIQUE;
        
        RAISE NOTICE 'Added idempotency_key column to payments table';
    ELSE
        RAISE NOTICE 'idempotency_key column already exists in payments table';
    END IF;
END $$;

-- Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key 
ON public.payments(idempotency_key);

-- Add comment to explain the column's purpose
COMMENT ON COLUMN public.payments.idempotency_key IS 
'Unique key for idempotent payment operations. Prevents duplicate payment processing when the same request is made multiple times.';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: idempotency_key column added to payments table with UNIQUE constraint and index';
END $$;

