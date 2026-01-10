-- ============================================================================
-- Fix Seats Decrement to Only Occur When Payment is Completed
-- ============================================================================
-- Issue: Seats are decremented immediately when booking is created/updated,
-- regardless of payment_status. This causes seats to be "stuck" at 0 even if
-- payment fails or is never completed.
--
-- Example Edge Case:
-- - User has 1 paid seat
-- - User books 1 more seat (total 2)
-- - payment_status = 'partial' (not completed)
-- - But seats_available is decremented from 1 to 0 immediately
-- - If payment fails, booking remains with payment_status = 'partial'/'failed'
-- - But seats_available stays at 0 (stuck seats)
--
-- Root Cause: Trigger decrements seats on INSERT/UPDATE regardless of payment_status
--
-- Fix: Only decrement seats when payment_status = 'completed'
-- - On INSERT: Only decrement if payment_status = 'completed'
-- - On UPDATE: Handle payment_status changes:
--   * pending/partial/failed → completed: Decrement seats
--   * completed → pending/failed/refunded: Restore seats
--   * completed → completed (seat change): Adjust seats
-- - On DELETE: Only restore if payment_status = 'completed'
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."update_seats_on_booking_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only decrement seats if payment is completed
    -- Unpaid bookings should not block seats
    IF NEW.payment_status = 'completed' THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
      
  ELSIF TG_OP = 'DELETE' THEN
    -- Only restore seats if booking was paid
    -- Unpaid bookings never decremented seats, so no need to restore
    IF OLD.payment_status = 'completed' THEN
      UPDATE rides 
      SET seats_available = seats_available + OLD.seats,
          updated_at = NOW()
      WHERE id = OLD.ride_id;
    END IF;
      
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle payment_status changes and seat changes
    
    -- Case 1: Payment just completed (pending/partial/failed → completed)
    -- Decrement seats for the first time
    IF OLD.payment_status != 'completed' AND NEW.payment_status = 'completed' THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
    
    -- Case 2: Payment was cancelled/refunded (completed → pending/failed/refunded)
    -- Restore seats that were previously decremented
    IF OLD.payment_status = 'completed' AND NEW.payment_status != 'completed' THEN
      UPDATE rides 
      SET seats_available = seats_available + OLD.seats,
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
    
    -- Case 3: Both OLD and NEW are completed, but seats changed
    -- Adjust seats: restore OLD.seats, decrement NEW.seats
    IF OLD.payment_status = 'completed' AND NEW.payment_status = 'completed' AND OLD.seats != NEW.seats THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available + OLD.seats - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
    
    -- Case 4: Both OLD and NEW are NOT completed, but seats changed
    -- No action needed (seats were never decremented, so nothing to adjust)
    -- This handles cases where unpaid bookings are modified before payment
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION "public"."update_seats_on_booking_change"() IS 'Updates seats_available in rides table only when payment_status = completed. Prevents seats from being blocked by unpaid bookings.';

-- ============================================================================
-- Update reserve_ride_seats function to remove manual seat updates
-- The trigger will now handle seat decrements based on payment_status
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."reserve_ride_seats"(
  "p_ride_id" "uuid", 
  "p_user_id" "uuid", 
  "p_seats" integer, 
  "p_booking_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS TABLE("success" boolean, "booking_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
BEGIN
  -- Lock the ride row for update to prevent concurrent access
  SELECT seats_available, driver_id INTO v_available_seats, v_ride_driver_id
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
    SELECT seats, status, payment_status INTO v_existing_booking_seats, v_existing_booking_status, v_existing_payment_status
    FROM bookings
    WHERE id = p_booking_id AND user_id = p_user_id AND ride_id = p_ride_id;
    
    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Booking not found or access denied'::TEXT;
      RETURN;
    END IF;
    
    -- Can't update completed or cancelled bookings
    IF v_existing_booking_status IN ('completed', 'cancelled') THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Cannot update booking with status: %s', v_existing_booking_status);
      RETURN;
    END IF;
    
    -- Prevent seat reduction on paid bookings
    IF v_existing_payment_status IN ('completed') AND p_seats < v_existing_booking_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        'Cannot reduce seats on a paid booking'::TEXT;
      RETURN;
    END IF;
    
    -- FIX: Prevent rebooking with same seats if already paid
    IF v_existing_payment_status IN ('completed') AND p_seats = v_existing_booking_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('You already have %s seat(s) booked and paid for this ride. To add more seats, please select a higher number.', v_existing_booking_seats);
      RETURN;
    END IF;
    
    -- Calculate effective available seats
    -- The user already has a booking, so their existing seats can be "reallocated"
    -- This gives them the ability to increase their booking
    -- Formula: effective = seats_available + existing_booking_seats
    -- Example: If seats_available = 1 and user has 1 seat booked, effective = 2
    -- This allows user to update from 1 seat to 2 seats
    -- Note: This works for both paid and unpaid bookings because:
    -- - Paid: seats were decremented, so add them back to calculate total available
    -- - Unpaid: seats were never decremented, but user "holds" them, so add them to get total
    v_effective_available := v_available_seats + v_existing_booking_seats;
    
    -- Check if enough seats for the update
    IF v_effective_available < p_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Only %s seats available for this update. You currently have %s seat(s) booked.', v_effective_available, v_existing_booking_seats);
      RETURN;
    END IF;
    
    -- Determine payment_status based on existing payment_status and seat change
    IF v_existing_payment_status = 'completed' AND p_seats > v_existing_booking_seats THEN
      -- Adding seats to paid booking: set to partial (user needs to pay for additional seats)
      v_new_payment_status := 'partial';
    ELSE
      -- For other cases, keep existing payment_status
      v_new_payment_status := v_existing_payment_status;
    END IF;
    
    -- Update the booking
    -- The trigger will handle seat decrements based on payment_status changes
    UPDATE bookings 
    SET seats = p_seats, 
        payment_status = v_new_payment_status,
        updated_at = NOW()
    WHERE id = p_booking_id;
    
    -- Verify update succeeded
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to update booking'::TEXT;
      RETURN;
    END IF;
    
    -- NOTE: No manual seat update needed - trigger handles it based on payment_status
    -- When payment completes later, trigger will decrement seats automatically
    
    RETURN QUERY SELECT TRUE, p_booking_id, NULL::TEXT;
    RETURN; -- Exit early for update mode
  END IF;
  
  -- ============================================
  -- CREATE MODE: Creating new booking
  -- ============================================
  
  -- Check if user already has a pending/confirmed booking for this ride
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
  
  -- Check if user has a cancelled/completed booking for this ride
  -- If so, we'll reactivate it instead of creating a new one
  SELECT id, seats, payment_status INTO v_cancelled_booking_id, v_cancelled_booking_seats, v_existing_payment_status
  FROM bookings
  WHERE ride_id = p_ride_id 
    AND user_id = p_user_id 
    AND status IN ('cancelled', 'completed')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_cancelled_booking_id IS NOT NULL THEN
    -- Reactivate the cancelled/completed booking
    -- Check if enough seats available
    -- Note: If original booking was paid, seats were restored when cancelled
    -- If original booking was unpaid, seats were never decremented
    -- In both cases, seats_available reflects available seats correctly
    IF v_available_seats < p_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Only %s seats available, requested %s', v_available_seats, p_seats);
      RETURN;
    END IF;
    
    -- Reactivate the cancelled booking
    -- Set payment_status based on original payment status
    -- If they already paid before cancellation, they might need to pay again (business decision)
    -- For now, set to 'pending' to require payment on reactivation
    UPDATE bookings
    SET seats = p_seats,
        status = 'pending',
        payment_status = 'pending', -- Require payment again on reactivation
        updated_at = NOW(),
        created_at = NOW()
    WHERE id = v_cancelled_booking_id;
    
    -- Verify update succeeded
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to reactivate booking'::TEXT;
      RETURN;
    END IF;
    
    -- NOTE: No manual seat update needed - trigger handles it
    -- Seats will only be decremented when payment completes (payment_status = 'completed')
    
    RETURN QUERY SELECT TRUE, v_cancelled_booking_id, NULL::TEXT;
    RETURN;
  END IF;
  
  -- No existing booking (active or cancelled), create a new one
  -- Check if enough seats available
  IF v_available_seats < p_seats THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 
      format('Only %s seats available, requested %s', v_available_seats, p_seats);
    RETURN;
  END IF;
  
  -- Create booking with payment_status = 'pending'
  -- Trigger will NOT decrement seats (payment not completed yet)
  INSERT INTO bookings (ride_id, user_id, seats, status, payment_status, created_at, updated_at)
  VALUES (p_ride_id, p_user_id, p_seats, 'pending', 'pending', NOW(), NOW())
  RETURNING id INTO v_booking_id;
  
  -- Verify booking was created
  IF v_booking_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to create booking'::TEXT;
    RETURN;
  END IF;
  
  -- NOTE: No manual seat update needed - trigger handles it
  -- Seats will only be decremented when payment completes (payment_status changes to 'completed')
  
  RETURN QUERY SELECT TRUE, v_booking_id, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  -- On any error, return failure
  RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM::TEXT;
END;
$$;

COMMENT ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer, "p_booking_id" "uuid") IS 'Creates or updates a booking. Seats are only decremented when payment_status = completed (handled by trigger).';
