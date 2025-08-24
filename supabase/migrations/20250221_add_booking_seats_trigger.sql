-- Migration to add automatic seats_available updates when bookings are created/deleted
-- This ensures the seats_available field stays in sync with actual bookings

-- Function to update seats when a booking is created
CREATE OR REPLACE FUNCTION update_seats_on_booking_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- When a booking is created, reduce available seats
    UPDATE rides 
    SET seats_available = GREATEST(0, seats_available - NEW.seats),
        updated_at = NOW()
    WHERE id = NEW.ride_id;
    
    RAISE NOTICE 'Reduced seats for ride % by % seats (new total: %)', 
      NEW.ride_id, NEW.seats, 
      (SELECT seats_available FROM rides WHERE id = NEW.ride_id);
      
  ELSIF TG_OP = 'DELETE' THEN
    -- When a booking is deleted, restore available seats
    UPDATE rides 
    SET seats_available = seats_available + OLD.seats,
        updated_at = NOW()
    WHERE id = OLD.ride_id;
    
    RAISE NOTICE 'Restored seats for ride % by % seats (new total: %)', 
      OLD.ride_id, OLD.seats, 
      (SELECT seats_available FROM rides WHERE id = OLD.ride_id);
      
  ELSIF TG_OP = 'UPDATE' THEN
    -- When a booking is updated, adjust seats accordingly
    IF OLD.seats != NEW.seats THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available + OLD.seats - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
      
      RAISE NOTICE 'Adjusted seats for ride %: +% -% = % (new total: %)', 
        NEW.ride_id, OLD.seats, NEW.seats, OLD.seats - NEW.seats,
        (SELECT seats_available FROM rides WHERE id = NEW.ride_id);
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_seats_on_booking_insert ON bookings;
DROP TRIGGER IF EXISTS update_seats_on_booking_delete ON bookings;
DROP TRIGGER IF EXISTS update_seats_on_booking_update ON bookings;

-- Create triggers for INSERT, DELETE, and UPDATE operations
CREATE TRIGGER update_seats_on_booking_insert
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_seats_on_booking_change();

CREATE TRIGGER update_seats_on_booking_delete
  AFTER DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_seats_on_booking_change();

CREATE TRIGGER update_seats_on_booking_update
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_seats_on_booking_change();

-- Add comments to clarify the purpose
COMMENT ON FUNCTION update_seats_on_booking_change() IS 'Automatically updates seats_available in rides table when bookings are created, updated, or deleted';
COMMENT ON TRIGGER update_seats_on_booking_insert ON bookings IS 'Updates seats when a new booking is created';
COMMENT ON TRIGGER update_seats_on_booking_delete ON bookings IS 'Updates seats when a booking is deleted';
COMMENT ON TRIGGER update_seats_on_booking_update ON bookings IS 'Updates seats when a booking is updated';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_seats_on_booking_change() TO authenticated;
