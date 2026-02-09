-- Adds partial_refund to payment_status enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'partial_refund'
      AND enumtypid = (
        SELECT oid
        FROM pg_type
        WHERE typname = 'payment_status'
      )
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'partial_refund';
    RAISE NOTICE 'Added partial_refund to payment_status enum';
  ELSE
    RAISE NOTICE 'partial_refund already exists in payment_status enum';
  END IF;
END $$;
