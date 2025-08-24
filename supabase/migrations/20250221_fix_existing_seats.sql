-- Migration to fix existing rides with incorrect seats_available values
-- This recalculates seats_available based on actual bookings

-- Function to recalculate seats_available for all rides
CREATE OR REPLACE FUNCTION recalculate_all_ride_seats()
RETURNS void AS $$
DECLARE
  ride_record RECORD;
  total_booked_seats integer;
  original_seats integer;
  ride_count integer := 0;
BEGIN
  -- Loop through all rides
  FOR ride_record IN 
    SELECT id, seats_available
    FROM rides
  LOOP
    BEGIN
      -- Calculate total booked seats for this ride
      SELECT COALESCE(SUM(seats), 0) INTO total_booked_seats
      FROM bookings 
      WHERE ride_id = ride_record.id 
      AND status NOT IN ('cancelled', 'rejected');
      
      -- Store the original seats_available as the "total" seats
      original_seats := ride_record.seats_available + total_booked_seats;
      
      -- Update seats_available to be original seats minus booked seats
      UPDATE rides 
      SET seats_available = GREATEST(0, original_seats - total_booked_seats),
          updated_at = NOW()
      WHERE id = ride_record.id;
      
      ride_count := ride_count + 1;
      RAISE NOTICE 'Fixed ride %: original_seats=%, booked_seats=%, new_seats_available=%', 
        ride_record.id, original_seats, total_booked_seats, 
        GREATEST(0, original_seats - total_booked_seats);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to fix ride %: %', ride_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Finished recalculating seats for % rides', ride_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to fix existing data
SELECT recalculate_all_ride_seats();

-- Drop the function after use
DROP FUNCTION recalculate_all_ride_seats();

-- Add a comment explaining what this migration did
COMMENT ON TABLE rides IS 'seats_available field is now automatically maintained by triggers on the bookings table';
