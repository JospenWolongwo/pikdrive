-- ============================================================================
-- Refund System Implementation
-- ============================================================================
-- Adds support for automatic refunds when bookings are cancelled
-- Supports both full and partial cancellations (seat reductions)
-- ============================================================================

-- ============================================================================
-- PART 1: Add partial_refund to payment_status enum
-- ============================================================================

-- Add partial_refund status to payment_status enum
-- Note: PostgreSQL doesn't support "IF NOT EXISTS" with ALTER TYPE ADD VALUE
-- So we use a DO block to check first
DO $$
BEGIN
  -- Check if 'partial_refund' already exists in the enum
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
    -- Add the enum value
    ALTER TYPE public.payment_status ADD VALUE 'partial_refund';
    RAISE NOTICE '✅ Added partial_refund to payment_status enum';
  ELSE
    RAISE NOTICE 'ℹ️ partial_refund already exists in payment_status enum';
  END IF;
END $$;

COMMENT ON TYPE public.payment_status IS 'Payment status enum: pending, processing, completed, failed, cancelled, refunded, partial_refund';

-- ============================================================================
-- PART 2: Create refunds table
-- ============================================================================

-- Create refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Refund details
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) DEFAULT 'XAF',
  
  -- Status (reuse payment_status enum)
  status public.payment_status DEFAULT 'pending'::public.payment_status,
  
  -- Provider information (matches payment)
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('mtn', 'orange', 'pawapay')),
  phone_number VARCHAR(20) NOT NULL, -- Phone that made the original payment
  transaction_id VARCHAR(100), -- Provider's refund transaction ID
  
  -- Refund type
  refund_type VARCHAR(20) DEFAULT 'full' CHECK (refund_type IN ('full', 'partial')),
  
  -- Reason and metadata
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.refunds OWNER TO postgres;

COMMENT ON TABLE public.refunds IS 'Tracks refunds for cancelled or partially cancelled bookings';
COMMENT ON COLUMN public.refunds.phone_number IS 'Phone number that made the original payment (refund destination)';
COMMENT ON COLUMN public.refunds.refund_type IS 'full: entire booking cancelled, partial: some seats reduced';
COMMENT ON COLUMN public.refunds.amount IS 'Amount refunded to customer';
COMMENT ON COLUMN public.refunds.payment_id IS 'Reference to the original payment being refunded';

-- ============================================================================
-- PART 3: Create indexes for refunds table
-- ============================================================================

CREATE INDEX idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX idx_refunds_booking_id ON public.refunds(booking_id);
CREATE INDEX idx_refunds_user_id ON public.refunds(user_id);
CREATE INDEX idx_refunds_status ON public.refunds(status);
CREATE INDEX idx_refunds_transaction_id ON public.refunds(transaction_id);

-- ============================================================================
-- PART 4: Enable RLS and create policies for refunds table
-- ============================================================================

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Users can view their own refunds
CREATE POLICY "refunds_select_own" ON public.refunds
  FOR SELECT USING (auth.uid() = user_id);

-- Only system can insert refunds (via service role)
CREATE POLICY "refunds_insert_system" ON public.refunds
  FOR INSERT WITH CHECK (false);

-- Only system can update refunds
CREATE POLICY "refunds_update_system" ON public.refunds
  FOR UPDATE USING (false);

-- ============================================================================
-- PART 5: Create restore_seats_to_ride function for partial cancellations
-- ============================================================================

-- Function to restore seats to ride (for partial cancellations)
CREATE OR REPLACE FUNCTION public.restore_seats_to_ride(
  p_ride_id UUID,
  p_seats INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate inputs
  IF p_ride_id IS NULL THEN
    RAISE EXCEPTION 'Ride ID cannot be null';
  END IF;
  
  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'Seats must be a positive integer';
  END IF;
  
  -- Update ride seats
  UPDATE rides
  SET seats_available = seats_available + p_seats,
      updated_at = NOW()
  WHERE id = p_ride_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found: %', p_ride_id;
  END IF;
  
  RAISE NOTICE 'Restored % seats to ride %', p_seats, p_ride_id;
END;
$$;

ALTER FUNCTION public.restore_seats_to_ride(UUID, INTEGER) OWNER TO postgres;

COMMENT ON FUNCTION public.restore_seats_to_ride(UUID, INTEGER) IS 'Restores seats to a ride when a booking is partially cancelled (seat reduction)';

-- ============================================================================
-- PART 6: Grant permissions
-- ============================================================================

-- Grant access to refunds table
GRANT ALL ON TABLE public.refunds TO postgres;
GRANT SELECT ON TABLE public.refunds TO anon;
GRANT SELECT ON TABLE public.refunds TO authenticated;
GRANT ALL ON TABLE public.refunds TO service_role;

-- Grant access to restore_seats_to_ride function
GRANT EXECUTE ON FUNCTION public.restore_seats_to_ride(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.restore_seats_to_ride(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_seats_to_ride(UUID, INTEGER) TO service_role;

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Refund system migration completed successfully!';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Added partial_refund to payment_status enum';
  RAISE NOTICE '  - Created refunds table with RLS policies';
  RAISE NOTICE '  - Created restore_seats_to_ride() function';
  RAISE NOTICE '  - Added proper indexes and constraints';
END $$;
