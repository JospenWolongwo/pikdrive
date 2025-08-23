-- Migration to add booking cancellation functionality
-- This function handles booking cancellation and seat restoration atomically

-- Function to cancel a booking and restore seats to the ride
CREATE OR REPLACE FUNCTION cancel_booking_and_restore_seats(
    p_booking_id uuid
) RETURNS boolean AS $$
DECLARE
    v_ride_id uuid;
    v_seats integer;
    v_current_status text;
    v_updated_rows integer;
BEGIN
    -- Get the current booking details
    SELECT ride_id, seats, status 
    INTO v_ride_id, v_seats, v_current_status
    FROM bookings 
    WHERE id = p_booking_id;
    
    -- Check if booking exists and can be cancelled
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id;
    END IF;
    
    -- Check if booking is already cancelled
    IF v_current_status = 'cancelled' THEN
        RAISE EXCEPTION 'Booking is already cancelled';
    END IF;
    
    -- Check if booking can be cancelled (only pending, confirmed, or pending_verification)
    IF v_current_status NOT IN ('pending', 'confirmed', 'pending_verification') THEN
        RAISE EXCEPTION 'Booking cannot be cancelled in current status: %', v_current_status;
    END IF;
    
    -- Start transaction
    BEGIN
        -- Update booking status to cancelled
        UPDATE bookings 
        SET 
            status = 'cancelled',
            updated_at = NOW()
        WHERE id = p_booking_id;
        
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
        
        IF v_updated_rows = 0 THEN
            RAISE EXCEPTION 'Failed to update booking status';
        END IF;
        
        -- Restore seats to the ride
        UPDATE rides 
        SET 
            seats_available = seats_available + v_seats,
            updated_at = NOW()
        WHERE id = v_ride_id;
        
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
        
        IF v_updated_rows = 0 THEN
            RAISE EXCEPTION 'Failed to update ride seats';
        END IF;
        
        -- Log the cancellation
        INSERT INTO payment_logs (payment_id, event_type, event_data)
        VALUES (
            p_booking_id, 
            'booking_cancelled', 
            jsonb_build_object(
                'booking_id', p_booking_id,
                'ride_id', v_ride_id,
                'seats_restored', v_seats,
                'previous_status', v_current_status,
                'cancelled_at', NOW()
            )
        );
        
        RAISE NOTICE 'Successfully cancelled booking % and restored % seats to ride %', 
            p_booking_id, v_seats, v_ride_id;
            
        RETURN true;
        
    EXCEPTION WHEN OTHERS THEN
        -- Rollback transaction on error
        RAISE EXCEPTION 'Error during cancellation: %', SQLERRM;
        RETURN false;
    END;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to the function
COMMENT ON FUNCTION cancel_booking_and_restore_seats(uuid) IS 
'Cancels a booking and restores the seats to the ride. Only works for pending, confirmed, or pending_verification bookings.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cancel_booking_and_restore_seats(uuid) TO authenticated;

-- Create index on bookings for faster status updates
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id);

