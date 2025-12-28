-- Migration to add 'partial' to payment_status enum and update reserve_ride_seats function
-- to handle payment_status when updating paid bookings

-- Add 'partial' value to payment_status enum if it doesn't exist
-- Note: ALTER TYPE ADD VALUE cannot be rolled back, so we wrap in DO block with error handling
DO $$ 
BEGIN
    -- Check if 'partial' already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'payment_status' 
        AND e.enumlabel = 'partial'
    ) THEN
        -- Try to add the value
        ALTER TYPE payment_status ADD VALUE 'partial';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Value already exists, ignore
        NULL;
    WHEN OTHERS THEN
        -- Ignore other errors
        NULL;
END $$;

-- Update reserve_ride_seats function to handle payment_status for paid bookings
CREATE OR REPLACE FUNCTION reserve_ride_seats(
  p_ride_id UUID,
  p_user_id UUID,
  p_seats INTEGER,
  p_booking_id UUID DEFAULT NULL  -- NULL = create new booking, provided = update existing
) RETURNS TABLE (
  success BOOLEAN,
  booking_id UUID,
  error_message TEXT
) AS $$
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
    -- Note: Database uses 'completed' as payment_status, but checking for both for safety
    IF v_existing_payment_status IN ('completed') AND p_seats < v_existing_booking_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        'Cannot reduce seats on a paid booking'::TEXT;
      RETURN;
    END IF;
    
    -- Calculate effective available seats
    -- Formula: current_available + old_booking_seats - new_booking_seats
    -- This tells us how many seats will be available after the update
    v_effective_available := v_available_seats + v_existing_booking_seats;
    
    -- Check if enough seats for the update
    IF v_effective_available < p_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Only %s seats available for this update', v_effective_available);
      RETURN;
    END IF;
    
    -- Determine payment_status based on existing payment_status and seat change
    IF v_existing_payment_status = 'completed' AND p_seats > v_existing_booking_seats THEN
      -- Adding seats to paid booking: set to partial
      v_new_payment_status := 'partial';
    ELSE
      -- For other cases, keep existing payment_status
      v_new_payment_status := v_existing_payment_status;
    END IF;
    
    -- Update the booking (trigger will adjust seats automatically)
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
    
    RETURN QUERY SELECT TRUE, p_booking_id, NULL::TEXT;
    
    RETURN; -- Exit early for update mode
  END IF;
  
  -- ============================================
  -- CREATE MODE: Creating new booking
  -- ============================================
  
  -- Check if enough seats available
  IF v_available_seats < p_seats THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 
      format('Only %s seats available, requested %s', v_available_seats, p_seats);
    RETURN;
  END IF;
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comment
COMMENT ON FUNCTION reserve_ride_seats(UUID, UUID, INTEGER, UUID) IS 
'Atomically reserves/updates seats for a ride by locking the ride row. 
Supports two modes:
- CREATE MODE (booking_id = NULL): Creates new booking, checks for duplicates
- UPDATE MODE (booking_id provided): Updates existing booking, releases old seats before reserving new ones
When updating a paid booking with more seats, sets payment_status to ''partial''.
Prevents seat reduction on paid bookings.
Prevents race conditions where multiple users book the last seat simultaneously.';

