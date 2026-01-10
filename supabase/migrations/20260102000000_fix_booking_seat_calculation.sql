-- ============================================================================
-- Fix Booking Seat Calculation in UPDATE Mode
-- ============================================================================
-- Issue: When users rebook (update existing booking), seats_available wasn't
-- being adjusted correctly because the trigger only fires if seats change.
-- If user books same number of seats (e.g., 1 seat -> 1 seat), trigger
-- doesn't fire, so seats_available stays stuck.
--
-- Root Cause: The reserve_ride_seats function in UPDATE mode relied on the
-- trigger to adjust seats, but trigger only fires when OLD.seats != NEW.seats.
--
-- Fix: Explicitly calculate and update seats_available after updating the
-- booking, ensuring consistency regardless of trigger behavior.
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
  v_new_seats_available INTEGER;  -- NEW: Store calculated seats_available
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
    -- If user already paid for X seats and tries to book X seats again, reject it
    -- This prevents multiple payments for the same booking
    IF v_existing_payment_status IN ('completed') AND p_seats = v_existing_booking_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('You already have %s seat(s) booked and paid for this ride. To add more seats, please select a higher number.', v_existing_booking_seats);
      RETURN;
    END IF;
    
    -- Calculate effective available seats (current available + seats from existing booking)
    -- This gives us the total seats available before we update the booking
    -- Example: If seats_available = 1 and existing_booking_seats = 1, then effective = 2
    -- This means we can update booking to 2 seats if needed
    v_effective_available := v_available_seats + v_existing_booking_seats;
    
    -- Check if enough seats for the update
    IF v_effective_available < p_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Only %s seats available for this update. You currently have %s seat(s) booked.', v_effective_available, v_existing_booking_seats);
      RETURN;
    END IF;
    
    -- Determine payment_status based on existing payment_status and seat change
    -- Scenario 1: Adding seats to paid booking (1 → 2): set to 'partial' (needs payment for additional seats)
    -- Scenario 2: Keeping same seats but not paid: keep existing payment_status
    IF v_existing_payment_status = 'completed' AND p_seats > v_existing_booking_seats THEN
      -- Adding seats to paid booking: set to partial (user needs to pay for additional seats)
      v_new_payment_status := 'partial';
    ELSE
      -- For other cases, keep existing payment_status
      v_new_payment_status := v_existing_payment_status;
    END IF;
    
    -- Calculate the correct seats_available after updating booking
    -- Formula: seats_available = effective_available - new_booking_seats
    -- Example: If seats_available = 1, existing_booking = 1, new_booking = 2
    --   effective = 1 + 1 = 2, new_seats_available = 2 - 2 = 0 ✓
    v_new_seats_available := GREATEST(0, v_effective_available - p_seats);
    
    -- Update the booking
    -- Note: The trigger will fire if seats change (OLD.seats != NEW.seats)
    -- The trigger adjusts: seats_available = seats_available + OLD.seats - NEW.seats
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
    
    -- FIX: Explicitly update seats_available to ensure consistency
    -- This ensures seats_available is correct in all cases:
    -- 1. If seats changed: Trigger fired and adjusted, but we set correct absolute value
    -- 2. If seats didn't change (prevented above): This won't execute, but kept for safety
    -- We use absolute calculation instead of relying on trigger delta calculation
    UPDATE rides
    SET seats_available = v_new_seats_available,
        updated_at = NOW()
    WHERE id = p_ride_id;
    
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
  SELECT id, seats INTO v_cancelled_booking_id, v_cancelled_booking_seats
  FROM bookings
  WHERE ride_id = p_ride_id 
    AND user_id = p_user_id 
    AND status IN ('cancelled', 'completed')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_cancelled_booking_id IS NOT NULL THEN
    -- Reactivate the cancelled/completed booking
    -- Seats from cancelled booking were already restored when it was cancelled
    -- Check if enough seats available for the new booking
    IF v_available_seats < p_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Only %s seats available, requested %s', v_available_seats, p_seats);
      RETURN;
    END IF;
    
    -- Update the cancelled booking to reactivate it
    -- Note: If seats change, the trigger will fire and adjust seats incorrectly
    -- (it assumes OLD.seats need to be restored, but they're already restored)
    -- So we'll manually fix seats_available after the update
    UPDATE bookings
    SET seats = p_seats,
        status = 'pending',
        payment_status = 'pending',
        updated_at = NOW(),
        created_at = NOW()
    WHERE id = v_cancelled_booking_id;
    
    -- Verify update succeeded
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to reactivate booking'::TEXT;
      RETURN;
    END IF;
    
    -- Manually fix seats_available
    -- If seats changed, trigger did: seats_available = seats_available + OLD.seats - NEW.seats
    -- But OLD.seats were already restored, so we need to subtract OLD.seats to compensate
    -- If seats didn't change, trigger didn't fire, so we need to subtract NEW.seats
    IF v_cancelled_booking_seats != p_seats THEN
      -- Trigger fired: compensate for its incorrect calculation
      UPDATE rides
      SET seats_available = GREATEST(0, seats_available - v_cancelled_booking_seats),
          updated_at = NOW()
      WHERE id = p_ride_id;
    ELSE
      -- Trigger didn't fire: manually subtract seats
      UPDATE rides
      SET seats_available = GREATEST(0, seats_available - p_seats),
          updated_at = NOW()
      WHERE id = p_ride_id;
    END IF;
    
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
  
  -- Create booking (seats will be reduced by trigger)
  INSERT INTO bookings (ride_id, user_id, seats, status, payment_status, created_at, updated_at)
  VALUES (p_ride_id, p_user_id, p_seats, 'pending', 'pending', NOW(), NOW())
  RETURNING id INTO v_booking_id;
  
  -- Verify booking was created
  IF v_booking_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to create booking'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, v_booking_id, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  -- On any error, return failure
  RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM::TEXT;
END;
$$;
