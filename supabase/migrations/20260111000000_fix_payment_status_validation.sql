-- ============================================================================
-- Fix Payment Status Validation - Prevent 'completed' Status Without Full Payment
-- ============================================================================
-- Issue: update_payment_and_booking_status sets payment_status='completed' 
-- without validating that ALL seats have been paid for.
--
-- Example Bug:
-- - User books 2 seats, pays 100 FCFA (2 × 50)
-- - User updates booking to 3 seats (should be 'partial')
-- - Payment callback fires → incorrectly sets payment_status='completed'
-- - Result: 3 seats booked but only 2 paid!
--
-- Fix: Only set payment_status='completed' if total payments >= booking amount
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."update_payment_and_booking_status"(
  "p_payment_id" "uuid", 
  "p_payment_status" "text", 
  "p_payment_time" timestamp with time zone, 
  "p_metadata" "jsonb"
) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_booking_id uuid;
    v_normalized_status text;
    v_booking_seats integer;
    v_ride_price numeric;
    v_total_amount_required numeric;
    v_total_amount_paid numeric;
    v_new_booking_status text;
    v_new_payment_status payment_status;
BEGIN
    -- Log input parameters
    RAISE NOTICE 'Input parameters: payment_id=%, payment_status=%, payment_time=%, metadata=%',
        p_payment_id, p_payment_status, p_payment_time, p_metadata;
    
    -- Normalize the status using our function
    v_normalized_status := normalize_payment_status(p_payment_status);
    RAISE NOTICE 'Normalized status from % to %', p_payment_status, v_normalized_status;

    -- Get the booking ID for this payment
    SELECT booking_id INTO v_booking_id
    FROM payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found: %', p_payment_id;
    END IF;

    -- Update payment status with normalized value
    UPDATE payments
    SET 
        status = v_normalized_status::payment_status,
        payment_time = CASE 
            WHEN v_normalized_status = 'completed' THEN COALESCE(p_payment_time, NOW())
            ELSE payment_time
        END,
        metadata = p_metadata,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- ============================================================================
    -- NEW VALIDATION: Calculate if booking is fully paid before setting 'completed'
    -- ============================================================================
    IF v_normalized_status = 'completed' THEN
        -- Get booking details and ride price
        SELECT b.seats, r.price 
        INTO v_booking_seats, v_ride_price
        FROM bookings b
        JOIN rides r ON b.ride_id = r.id
        WHERE b.id = v_booking_id;
        
        -- Calculate total amount required for all seats
        v_total_amount_required := v_booking_seats * v_ride_price;
        
        -- Calculate total amount paid (sum of all completed payments)
        SELECT COALESCE(SUM(amount), 0)
        INTO v_total_amount_paid
        FROM payments
        WHERE booking_id = v_booking_id
          AND status = 'completed';
        
        RAISE NOTICE 'Payment validation: booking_id=%, seats=%, price=%, required=%, paid=%',
            v_booking_id, v_booking_seats, v_ride_price, v_total_amount_required, v_total_amount_paid;
        
        -- Determine correct payment status based on amount paid
        IF v_total_amount_paid >= v_total_amount_required THEN
            -- Fully paid - all seats covered
            v_new_payment_status := 'completed';
            v_new_booking_status := 'pending_verification';
            RAISE NOTICE 'Booking fully paid: setting payment_status=completed';
        ELSE
            -- Partially paid - some seats not covered yet
            v_new_payment_status := 'partial';
            v_new_booking_status := 'pending';
            RAISE NOTICE 'Booking partially paid: setting payment_status=partial (paid=%, required=%)',
                v_total_amount_paid, v_total_amount_required;
        END IF;
        
        -- Update booking with validated status
        UPDATE bookings
        SET 
            status = v_new_booking_status,
            payment_status = v_new_payment_status,
            updated_at = NOW()
        WHERE id = v_booking_id;
        
    ELSIF v_normalized_status = 'failed' THEN
        -- Payment failed - mark booking as cancelled
        UPDATE bookings
        SET 
            status = 'cancelled',
            payment_status = v_normalized_status::payment_status,
            updated_at = NOW()
        WHERE id = v_booking_id;
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in update_payment_and_booking_status: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RAISE NOTICE 'Input status was: %, normalized to: %', p_payment_status, v_normalized_status;
    RAISE;
END;
$$;

COMMENT ON FUNCTION "public"."update_payment_and_booking_status"(
  "p_payment_id" "uuid", 
  "p_payment_status" "text", 
  "p_payment_time" timestamp with time zone, 
  "p_metadata" "jsonb"
) IS 'Updates payment and booking status with validation. Only sets payment_status=completed if total payments >= required amount for all seats.';
