-- Migration to add atomic seat reservation function
-- This prevents race conditions where two users book the last seat simultaneously

-- Function to atomically reserve seats with row-level locking
CREATE OR REPLACE FUNCTION reserve_ride_seats(
  p_ride_id UUID,
  p_user_id UUID,
  p_seats INTEGER
) RETURNS TABLE (
  success BOOLEAN,
  booking_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_available_seats INTEGER;
  v_booking_id UUID;
  v_ride_driver_id UUID;
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
    RETURN QUERY SELECT FALSE, NULL::UUID, 'User already has a booking for this ride'::TEXT;
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION reserve_ride_seats(UUID, UUID, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION reserve_ride_seats(UUID, UUID, INTEGER) IS 
'Atomically reserves seats for a ride by locking the ride row. Prevents race conditions where multiple users book the last seat simultaneously. Returns success status, booking_id, and error message if failed.';

