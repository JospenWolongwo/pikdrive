-- Drop the payment_id column from bookings if it exists
ALTER TABLE public.bookings DROP COLUMN IF EXISTS payment_id;

-- Create indexes if they don't exist
DO $$ 
BEGIN
    -- Create booking_id index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'payments_booking_id_idx') THEN
        CREATE INDEX payments_booking_id_idx ON public.payments(booking_id);
    END IF;
    
    -- Create transaction_id index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'payments_transaction_id_idx') THEN
        CREATE INDEX payments_transaction_id_idx ON public.payments(transaction_id);
    END IF;
    
    -- Create payment_logs index if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'payment_logs_payment_id_idx') THEN
        CREATE INDEX payment_logs_payment_id_idx ON public.payment_logs(payment_id);
    END IF;
END $$;

-- Ensure RLS policies exist
DO $$ 
BEGIN
    -- Payments policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payments' 
        AND policyname = 'Users can view their own payments'
    ) THEN
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
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payments' 
        AND policyname = 'Users can create payments for their own bookings'
    ) THEN
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
    END IF;

    -- Payment logs policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payment_logs' 
        AND policyname = 'Users can view their own payment logs'
    ) THEN
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
    END IF;
END $$;
