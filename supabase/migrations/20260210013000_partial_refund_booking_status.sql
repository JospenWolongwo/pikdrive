-- Align booking/payment seat logic with partial_refund semantics

-- Normalize payment status to include partial_refund
CREATE OR REPLACE FUNCTION public.normalize_payment_status(status text) RETURNS text
    LANGUAGE plpgsql
AS $$
BEGIN
    -- Convert to lowercase and trim
    status := lower(trim(status));
    
    -- Map values
    RETURN CASE status
        WHEN 'successful' THEN 'completed'
        WHEN 'failed' THEN 'failed'
        WHEN 'pending' THEN 'pending'
        WHEN 'processing' THEN 'processing'
        WHEN 'completed' THEN 'completed'
        WHEN 'refunded' THEN 'refunded'
        WHEN 'partial_refund' THEN 'partial_refund'
        ELSE 'pending'
    END;
END;
$$;

-- Treat partial_refund as paid for seat reservation rules
CREATE OR REPLACE FUNCTION public.reserve_ride_seats(
    p_ride_id uuid,
    p_user_id uuid,
    p_seats integer,
    p_booking_id uuid DEFAULT NULL::uuid
) RETURNS TABLE(success boolean, booking_id uuid, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
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
    IF v_existing_payment_status IN ('completed', 'partial_refund') AND p_seats < v_existing_booking_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        'Cannot reduce seats on a paid booking'::TEXT;
      RETURN;
    END IF;
    
    -- Calculate effective available seats
    v_effective_available := v_available_seats + v_existing_booking_seats;
    
    -- Check if enough seats for the update
    IF v_effective_available < p_seats THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 
        format('Only %s seats available for this update', v_effective_available);
      RETURN;
    END IF;
    
    -- Determine payment_status based on existing payment_status and seat change
    IF v_existing_payment_status IN ('completed', 'partial_refund') AND p_seats > v_existing_booking_seats THEN
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
$$;

-- Update seat trigger to treat partial_refund as paid
CREATE OR REPLACE FUNCTION public.update_seats_on_booking_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only decrement seats if booking is paid
    IF NEW.payment_status IN ('completed', 'partial_refund') THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
      
  ELSIF TG_OP = 'DELETE' THEN
    -- Only restore seats if booking was paid
    IF OLD.payment_status IN ('completed', 'partial_refund') THEN
      UPDATE rides 
      SET seats_available = seats_available + OLD.seats,
          updated_at = NOW()
      WHERE id = OLD.ride_id;
    END IF;
      
  ELSIF TG_OP = 'UPDATE' THEN
    -- Case 1: Booking becomes paid (unpaid -> paid)
    IF OLD.payment_status NOT IN ('completed', 'partial_refund')
      AND NEW.payment_status IN ('completed', 'partial_refund') THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
    
    -- Case 2: Booking becomes unpaid (paid -> unpaid)
    IF OLD.payment_status IN ('completed', 'partial_refund')
      AND NEW.payment_status NOT IN ('completed', 'partial_refund') THEN
      UPDATE rides 
      SET seats_available = seats_available + OLD.seats,
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
    
    -- Case 3: Both paid and seats changed
    IF OLD.payment_status IN ('completed', 'partial_refund')
      AND NEW.payment_status IN ('completed', 'partial_refund')
      AND OLD.seats != NEW.seats THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available + OLD.seats - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;
