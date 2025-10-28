-- Migration to add atomic seat reservation function
-- This prevents race conditions where two users book the last seat simultaneously

-- Function to atomically reserve seats with row-level locking
-- Supports both CREATE (new booking) and UPDATE (modify existing booking) modes
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
    -- Get current booking details
    SELECT seats, status INTO v_existing_booking_seats, v_existing_booking_status
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
    
    -- Calculate effective available seats
    -- Formula: current_available + old_booking_seats - new_booking_seats
    -- This tells us how many seats will be available after the update
    DECLARE
      v_effective_available INTEGER;
    BEGIN
      v_effective_available := v_available_seats + v_existing_booking_seats;
      
      -- Check if enough seats for the update
      IF v_effective_available < p_seats THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 
          format('Only %s seats available for this update', v_effective_available);
        RETURN;
      END IF;
      
      -- Update the booking (trigger will adjust seats automatically)
      UPDATE bookings 
      SET seats = p_seats, updated_at = NOW()
      WHERE id = p_booking_id;
      
      -- Verify update succeeded
      GET DIAGNOSTICS v_booking_id = ROW_COUNT;
      IF v_booking_id = 0 THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to update booking'::TEXT;
        RETURN;
      END IF;
      
      RETURN QUERY SELECT TRUE, p_booking_id, NULL::TEXT;
    END;
    
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

-- Grant execute permission for both old and new signatures
GRANT EXECUTE ON FUNCTION reserve_ride_seats(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_ride_seats(UUID, UUID, INTEGER, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION reserve_ride_seats(UUID, UUID, INTEGER, UUID) IS 
'Atomically reserves/updates seats for a ride by locking the ride row. 
Supports two modes:
- CREATE MODE (booking_id = NULL): Creates new booking, checks for duplicates
- UPDATE MODE (booking_id provided): Updates existing booking, releases old seats before reserving new ones
Prevents race conditions where multiple users book the last seat simultaneously.';

