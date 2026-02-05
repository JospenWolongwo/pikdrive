-- ============================================================================
-- Fix double seat restoration on reduce-seats (completed → partial)
-- ============================================================================
-- Issue: When a passenger reduces seats (e.g. 2 → 1), two things run:
--   1. Trigger update_seats_on_booking_change Case 2: completed → not completed
--      restores OLD.seats (2) — wrong for partial reduction.
--   2. reduce-seats API calls restore_seats_to_ride(1).
-- Result: ride gains 3 seats instead of 1 (e.g. 2 → 5).
--
-- Fix: In the trigger, when going completed → partial with fewer seats,
-- restore only (OLD.seats - NEW.seats). Full cancel/refund still restores
-- OLD.seats. The reduce-seats API will stop calling restore_seats_to_ride
-- so the trigger is the single source of truth.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."update_seats_on_booking_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only decrement seats if payment is completed
    IF NEW.payment_status = 'completed' THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
      
  ELSIF TG_OP = 'DELETE' THEN
    -- Only restore seats if booking was paid
    IF OLD.payment_status = 'completed' THEN
      UPDATE rides 
      SET seats_available = seats_available + OLD.seats,
          updated_at = NOW()
      WHERE id = OLD.ride_id;
    END IF;
      
  ELSIF TG_OP = 'UPDATE' THEN
    -- Case 1: Payment just completed (pending/partial/failed → completed)
    IF OLD.payment_status != 'completed' AND NEW.payment_status = 'completed' THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
    
    -- Case 2: Payment was cancelled/refunded (completed → not completed)
    -- Partial seat reduction: restore only freed seats. Full cancel: restore all.
    IF OLD.payment_status = 'completed' AND NEW.payment_status != 'completed' THEN
      IF NEW.payment_status = 'partial' AND OLD.seats > NEW.seats THEN
        -- Seat reduction: only restore (OLD.seats - NEW.seats)
        UPDATE rides 
        SET seats_available = seats_available + (OLD.seats - NEW.seats),
            updated_at = NOW()
        WHERE id = NEW.ride_id;
      ELSE
        -- Full cancel/refund: restore all seats that were decremented
        UPDATE rides 
        SET seats_available = seats_available + OLD.seats,
            updated_at = NOW()
        WHERE id = NEW.ride_id;
      END IF;
    END IF;
    
    -- Case 3: Both OLD and NEW are completed, but seats changed
    IF OLD.payment_status = 'completed' AND NEW.payment_status = 'completed' AND OLD.seats != NEW.seats THEN
      UPDATE rides 
      SET seats_available = GREATEST(0, seats_available + OLD.seats - NEW.seats),
          updated_at = NOW()
      WHERE id = NEW.ride_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION "public"."update_seats_on_booking_change"() IS 'Updates seats_available in rides table only when payment_status = completed. Handles partial seat reduction (completed→partial) by restoring only freed seats.';
