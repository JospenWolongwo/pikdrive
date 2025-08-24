-- Migration to add automatic notifications for booking status changes
-- This leverages the existing push notification infrastructure

-- Create function to send notifications when booking status changes
CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_ride_id uuid;
    v_passenger_id uuid;
    v_driver_id uuid;
    v_ride_from_city text;
    v_ride_to_city text;
    v_passenger_name text;
    v_driver_name text;
    v_seats integer;
BEGIN
    -- Get ride and user details
    SELECT 
        r.driver_id,
        r.from_city,
        r.to_city,
        NEW.seats
    INTO v_driver_id, v_ride_from_city, v_ride_to_city, v_seats
    FROM rides r
    WHERE r.id = NEW.ride_id;
    
    v_passenger_id := NEW.user_id;
    
    -- Get user names
    SELECT full_name INTO v_passenger_name
    FROM profiles
    WHERE id = v_passenger_id;
    
    SELECT full_name INTO v_driver_name
    FROM profiles
    WHERE id = v_driver_id;
    
    -- Set default names if not found
    v_passenger_name := COALESCE(v_passenger_name, 'Passager');
    v_driver_name := COALESCE(v_driver_name, 'Chauffeur');
    
    -- Handle different status changes
    IF TG_OP = 'INSERT' THEN
        -- New booking created - notify driver
        PERFORM pg_notify(
            'booking_notification',
            json_build_object(
                'type', 'new_booking',
                'userId', v_driver_id,
                'title', '🚗 Nouvelle Reservation !',
                'body', v_passenger_name || ' a reserve ' || v_seats || ' place(s) pour ' || v_ride_from_city || ' → ' || v_ride_to_city,
                'data', json_build_object(
                    'bookingId', NEW.id,
                    'rideId', NEW.ride_id,
                    'passengerId', v_passenger_id,
                    'type', 'new_booking'
                )
            )::text
        );
        
        RAISE NOTICE 'Notification sent to driver % for new booking %', v_driver_id, NEW.id;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Status change - handle different scenarios
        IF NEW.status = 'pending_verification' AND OLD.status = 'pending' THEN
            -- Payment completed - notify passenger and driver
            PERFORM pg_notify(
                'booking_notification',
                json_build_object(
                    'type', 'payment_completed',
                    'userId', v_passenger_id,
                    'title', '🎉 Paiement Confirme !',
                    'body', 'Votre reservation est confirmee. Le chauffeur va bientot verifier votre code.',
                    'data', json_build_object(
                        'bookingId', NEW.id,
                        'rideId', NEW.ride_id,
                        'type', 'payment_completed'
                    )
                )::text
            );
            
            PERFORM pg_notify(
                'booking_notification',
                json_build_object(
                    'type', 'payment_completed_driver',
                    'userId', v_driver_id,
                    'title', '💳 Paiement Recu !',
                    'body', 'Le paiement de ' || v_passenger_name || ' a ete recu. Verifiez le code de reservation.',
                    'data', json_build_object(
                        'bookingId', NEW.id,
                        'rideId', NEW.ride_id,
                        'passengerId', v_passenger_id,
                        'type', 'payment_completed_driver'
                    )
                )::text
            );
            
            RAISE NOTICE 'Payment completed notifications sent for booking %', NEW.id;
            
        ELSIF NEW.status = 'confirmed' AND OLD.status = 'pending_verification' THEN
            -- Code verified - notify passenger
            PERFORM pg_notify(
                'booking_notification',
                json_build_object(
                    'type', 'booking_confirmed',
                    'userId', v_passenger_id,
                    'title', '✅ Reservation Confirmee !',
                    'body', 'Votre reservation a ete verifiee par ' || v_driver_name || '. Bon voyage !',
                    'data', json_build_object(
                        'bookingId', NEW.id,
                        'rideId', NEW.ride_id,
                        'type', 'booking_confirmed'
                    )
                )::text
            );
            
            RAISE NOTICE 'Booking confirmed notification sent for booking %', NEW.id;
            
        ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
            -- Booking cancelled - notify both parties
            PERFORM pg_notify(
                'booking_notification',
                json_build_object(
                    'type', 'booking_cancelled',
                    'userId', v_passenger_id,
                    'title', '❌ Reservation Annulee',
                    'body', 'Votre reservation a ete annulee.',
                    'data', json_build_object(
                        'bookingId', NEW.id,
                        'rideId', NEW.ride_id,
                        'type', 'booking_cancelled'
                    )
                )::text
            );
            
            PERFORM pg_notify(
                'booking_notification',
                json_build_object(
                    'type', 'booking_cancelled_driver',
                    'userId', v_driver_id,
                    'title', '❌ Reservation Annulee',
                    'body', 'La reservation de ' || v_passenger_name || ' a ete annulee.',
                    'data', json_build_object(
                        'bookingId', NEW.id,
                        'rideId', NEW.ride_id,
                        'passengerId', v_passenger_id,
                        'type', 'booking_cancelled_driver'
                    )
                )::text
            );
            
            RAISE NOTICE 'Booking cancelled notifications sent for booking %', NEW.id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for booking changes
DROP TRIGGER IF EXISTS notify_booking_status_change_trigger ON bookings;
CREATE TRIGGER notify_booking_status_change_trigger
    AFTER INSERT OR UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_booking_status_change();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION notify_booking_status_change() TO authenticated;

-- Add comments
COMMENT ON FUNCTION notify_booking_status_change() IS 'Automatically sends notifications when booking status changes, leveraging existing push notification infrastructure';
COMMENT ON TRIGGER notify_booking_status_change_trigger ON bookings IS 'Triggers notifications for booking status changes';
