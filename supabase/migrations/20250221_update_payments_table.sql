-- Add status column to payments table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.payments 
        ADD COLUMN status payment_status DEFAULT 'pending';
    END IF;
END $$;

-- Update existing payments to have a status
UPDATE public.payments 
SET status = 'completed' 
WHERE payment_time IS NOT NULL 
  AND metadata->>'financialTransactionId' IS NOT NULL;
