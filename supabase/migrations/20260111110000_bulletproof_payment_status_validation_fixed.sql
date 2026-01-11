-- ============================================================================
-- Bulletproof Payment Status Validation (FIXED VERSION)
-- ============================================================================
-- Issue: reserve_ride_seats correctly calculates payment_status='partial' when
-- adding seats to paid booking, BUT the value doesn't persist or gets overridden.
--
-- Root Cause Analysis:
-- 1. Condition logic works (v_existing_payment_status='completed' AND p_seats > old_seats)
-- 2. But payment_status stays 'completed' after update
-- 3. Likely causes: type casting, transaction commit order, or trigger override
--
-- Solution: DEFENSIVE PROGRAMMING
-- - Always validate payment_status against ACTUAL payments after any booking update
-- - Add explicit type casting to prevent silent failures
-- - Add logging to track what's happening
-- - Clean up existing corrupted data
--
-- FIX: Corrected ambiguous column reference in cleanup section
-- ============================================================================

-- ============================================================================
-- PART 1: Fix reserve_ride_seats with Defensive Validation
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."reserve_ride_seats"(
  "p_ride_id" "uuid", 
  "p_user_id" "uuid", 
  "p_seats" integer, 
  "p_booking_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS TABLE("success" boolean, "booking_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
AS $function$
DECLARE
  v_available_seats INTEGER;
  v_existing_booking_seats INTEGER DEFAULT 0;
  v_booking_id UUID;
  v_ride_driver_id UUID;
  v_existing_booking_status TEXT;
  v_existing_payment_status payment_status;
  v_effective_available INTEGER;
  v_new_payment_status payment_status;
  v_row_count INTEGER;
  v_cancelled_booking_id UUID;
  v_cancelled_booking_seats INTEGER;
  v_ride_price NUMERIC;
  v_total_paid NUMERIC;
  v_total_required NUMERIC;
BEGIN
  -- Lock the ride row for update to prevent concurrent access
  SELECT seats_available, driver_id, price 
  INTO v_available_seats, v_ride_driver_id, v_ride_price
  FROM rides
  WHERE id = p_ride_id
  FOR UPDATE;
  
  -- Check if ride exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Ride not found'::TEXT;
    RETURN;
  END IF;
  
  -- Prevent driver from booking their own ride
  IF v_ride_driver_id = p_user_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Driver cannot book their own ride'::TEXT;
    RETURN;
  END IF;
  
  -- ============================================
  -- UPDATE MODE: Updating existing booking
  -- ============================================
  IF p_booking_id IS NOT NULL THEN
    -- Get current booking details including payment_status
    SELECT seats, status, payment_status 
    INTO v_existing_booking_seats, v_existing_booking_status, v_existing_payment_status
    FROM bookings
    WHERE id = p_booking_id AND user_id = p_user_id AND ride_id = p_ride_id;
    
    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Booking not found or access denied'::TEXT;
      RETURN;
    END IF;
    
    RAISE NOTICE '[RESERVE] Update mode: booking_id=%, existing_seats=%, new_seats=%, existing_payment_status=%',
      p_booking_id, v_existing_booking_seats, p_seats, v_existing_payment_status;
    
    -- Can't update completed or cancelled bookings
    IF v_existing_booking_status IN ('completed', 'cancelled') THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Cannot update booking with status: %s', v_existing_booking_status);
      RETURN;
    END IF;
    
    -- Prevent seat reduction on paid bookings
    IF v_existing_payment_status = 'completed'::payment_status AND p_seats < v_existing_booking_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        'Cannot reduce seats on a paid booking'::TEXT;
      RETURN;
    END IF;
    
    -- Prevent rebooking with same seats if already paid
    IF v_existing_payment_status = 'completed'::payment_status AND p_seats = v_existing_booking_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('You already have %s seat(s) booked and paid for this ride. To add more seats, please select a higher number.', v_existing_booking_seats);
      RETURN;
    END IF;
    
    -- Calculate effective available seats
    v_effective_available := v_available_seats + v_existing_booking_seats;
    
    -- Check if enough seats for the update
    IF v_effective_available < p_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Only %s seats available for this update. You currently have %s seat(s) booked.', v_effective_available, v_existing_booking_seats);
      RETURN;
    END IF;
    
    -- Determine initial payment_status based on seat change
    IF v_existing_payment_status = 'completed'::payment_status AND p_seats > v_existing_booking_seats THEN
      v_new_payment_status := 'partial'::payment_status;
      RAISE NOTICE '[RESERVE] Setting payment_status to partial (adding seats to paid booking)';
    ELSE
      v_new_payment_status := v_existing_payment_status;
      RAISE NOTICE '[RESERVE] Keeping payment_status as %', v_existing_payment_status;
    END IF;
    
    -- Update the booking with calculated payment_status
    UPDATE bookings 
    SET seats = p_seats, 
        payment_status = v_new_payment_status,
        status = CASE 
          WHEN v_new_payment_status = 'partial'::payment_status THEN 'pending'
          ELSE status
        END,
        updated_at = NOW()
    WHERE id = p_booking_id;
    
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to update booking'::TEXT;
      RETURN;
    END IF;
    
    RAISE NOTICE '[RESERVE] Booking updated: seats=%, payment_status=%', p_seats, v_new_payment_status;
    
    -- ============================================================================
    -- DEFENSIVE VALIDATION: Always verify payment_status against actual payments
    -- This prevents silent failures and ensures consistency
    -- ============================================================================
    
    -- Calculate total paid vs total required
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM payments
    WHERE booking_id = p_booking_id AND status = 'completed'::payment_status;
    
    v_total_required := p_seats * v_ride_price;
    
    RAISE NOTICE '[DEFENSIVE] Validation: paid=%, required=%, current_payment_status=%',
      v_total_paid, v_total_required, v_new_payment_status;
    
    -- If underpaid, FORCE payment_status to 'partial'
    IF v_total_paid < v_total_required THEN
      UPDATE bookings 
      SET payment_status = 'partial'::payment_status,
          status = 'pending',
          updated_at = NOW()
      WHERE id = p_booking_id 
        AND payment_status != 'partial'::payment_status;
      
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      IF v_row_count > 0 THEN
        RAISE NOTICE '[DEFENSIVE] CORRECTED: Forced payment_status to partial (was incorrect)';
      END IF;
    -- If fully paid, FORCE payment_status to 'completed'
    ELSIF v_total_paid >= v_total_required THEN
      UPDATE bookings 
      SET payment_status = 'completed'::payment_status,
          status = 'pending_verification',
          updated_at = NOW()
      WHERE id = p_booking_id 
        AND payment_status != 'completed'::payment_status;
      
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      IF v_row_count > 0 THEN
        RAISE NOTICE '[DEFENSIVE] CORRECTED: Forced payment_status to completed (was incorrect)';
      END IF;
    END IF;
    
    RETURN QUERY SELECT TRUE, p_booking_id, NULL::TEXT;
    RETURN;
  END IF;
  
  -- ============================================
  -- CREATE MODE: Creating new booking
  -- ============================================
  
  -- Check if user already has a pending/confirmed booking
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE ride_id = p_ride_id 
    AND user_id = p_user_id 
    AND status NOT IN ('cancelled', 'completed')
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 
      'User already has a booking for this ride'::TEXT;
    RETURN;
  END IF;
  
  -- Check if user has a cancelled/completed booking to reactivate
  SELECT id, seats, payment_status 
  INTO v_cancelled_booking_id, v_cancelled_booking_seats, v_existing_payment_status
  FROM bookings
  WHERE ride_id = p_ride_id 
    AND user_id = p_user_id 
    AND status IN ('cancelled', 'completed')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_cancelled_booking_id IS NOT NULL THEN
    -- Reactivate booking
    IF v_available_seats < p_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Only %s seats available, requested %s', v_available_seats, p_seats);
      RETURN;
    END IF;
    
    UPDATE bookings
    SET seats = p_seats,
        status = 'pending',
        payment_status = 'pending'::payment_status,
        updated_at = NOW(),
        created_at = NOW()
    WHERE id = v_cancelled_booking_id;
    
    RETURN QUERY SELECT TRUE, v_cancelled_booking_id, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Create new booking
  IF v_available_seats < p_seats THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 
      format('Only %s seats available, requested %s', v_available_seats, p_seats);
    RETURN;
  END IF;
  
  INSERT INTO bookings (ride_id, user_id, seats, status, payment_status, created_at, updated_at)
  VALUES (p_ride_id, p_user_id, p_seats, 'pending', 'pending'::payment_status, NOW(), NOW())
  RETURNING id INTO v_booking_id;
  
  IF v_booking_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to create booking'::TEXT;
    RETURN;
  END IF;
  
  RAISE NOTICE '[RESERVE] Created new booking: id=%, seats=%', v_booking_id, p_seats;
  
  RETURN QUERY SELECT TRUE, v_booking_id, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[RESERVE] ERROR: %', SQLERRM;
  RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM::TEXT;
END;
$function$;

COMMENT ON FUNCTION "public"."reserve_ride_seats"(
  "p_ride_id" "uuid", 
  "p_user_id" "uuid", 
  "p_seats" integer, 
  "p_booking_id" "uuid"
) IS 'Creates or updates bookings with DEFENSIVE payment_status validation. Always verifies against actual payments to ensure consistency.';

-- ============================================================================
-- PART 2: Clean Up Existing Corrupted Bookings (FIXED VERSION)
-- ============================================================================

DO $$
DECLARE
  v_corrected_count INTEGER := 0;
  v_booking RECORD;
BEGIN
  RAISE NOTICE '[CLEANUP] Starting cleanup of corrupted bookings...';
  
  -- Find and fix all bookings with incorrect payment_status
  -- FIX: Use subquery to avoid ambiguous column reference
  FOR v_booking IN
    SELECT 
      b.id,
      b.seats,
      b.payment_status,
      b.status,
      r.price,
      b.seats * r.price as required_amount,
      (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payments p
        WHERE p.booking_id = b.id AND p.status = 'completed'
      ) as paid_amount
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    WHERE b.status NOT IN ('cancelled', 'completed')
  LOOP
    -- Check if payment_status is incorrect
    IF v_booking.paid_amount < v_booking.required_amount AND v_booking.payment_status = 'completed' THEN
      -- Underpaid but marked as completed: set to partial
      UPDATE bookings 
      SET payment_status = 'partial'::payment_status,
          status = 'pending',
          updated_at = NOW()
      WHERE id = v_booking.id;
      
      v_corrected_count := v_corrected_count + 1;
      RAISE NOTICE '[CLEANUP] Fixed booking %: Set to partial (paid=%, required=%)',
        v_booking.id, v_booking.paid_amount, v_booking.required_amount;
        
    ELSIF v_booking.paid_amount >= v_booking.required_amount AND v_booking.payment_status IN ('partial', 'pending') THEN
      -- Fully paid but marked as partial/pending: set to completed
      UPDATE bookings 
      SET payment_status = 'completed'::payment_status,
          status = 'pending_verification',
          updated_at = NOW()
      WHERE id = v_booking.id;
      
      v_corrected_count := v_corrected_count + 1;
      RAISE NOTICE '[CLEANUP] Fixed booking %: Set to completed (paid=%, required=%)',
        v_booking.id, v_booking.paid_amount, v_booking.required_amount;
    END IF;
  END LOOP;
  
  RAISE NOTICE '[CLEANUP] Cleanup complete. Corrected % bookings.', v_corrected_count;
END $$;

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Bulletproof payment status validation applied successfully!';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Defensive validation in reserve_ride_seats';
  RAISE NOTICE '  - Automatic correction of corrupted bookings';
  RAISE NOTICE '  - Detailed logging for debugging';
  RAISE NOTICE '  - Explicit type casting to prevent silent failures';
  RAISE NOTICE '  - FIXED: Ambiguous column reference in cleanup query';
END $$;
