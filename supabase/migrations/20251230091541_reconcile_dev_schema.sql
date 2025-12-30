

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS '
{"cors_rules": [
  {
    "origin": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    "headers": ["*"],
    "credentials": true
  }
]}
';



CREATE TYPE "public"."driver_application_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE "public"."driver_application_status" OWNER TO "postgres";


CREATE TYPE "public"."driver_status" AS ENUM (
    'PENDING',
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);


ALTER TYPE "public"."driver_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_provider" AS ENUM (
    'mtn',
    'orange'
);


ALTER TYPE "public"."payment_provider" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded',
    'partial'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."payout_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


ALTER TYPE "public"."payout_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'USER',
    'DRIVER',
    'DRIVER_PENDING',
    'ADMIN'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."begin_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Nothing needed as Supabase automatically starts transaction
    NULL;
END;
$$;


ALTER FUNCTION "public"."begin_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_booking_and_restore_seats"("p_booking_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."cancel_booking_and_restore_seats"("p_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_booking_and_restore_seats"("p_booking_id" "uuid") IS 'Cancels a booking and restores the seats to the ride. Only works for pending, confirmed, or pending_verification bookings.';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_payment_events"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- Delete completed events older than 30 days
  DELETE FROM payment_event_queue
  WHERE status = 'completed'
    AND processed_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Delete failed events older than 7 days that exceeded max retries
  DELETE FROM payment_event_queue
  WHERE status = 'failed'
    AND retry_count >= max_retries
    AND created_at < NOW() - INTERVAL '7 days';
  
  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_payment_events"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_payment_events"() IS 'Removes old processed events to prevent table bloat';



CREATE OR REPLACE FUNCTION "public"."commit_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Nothing needed as commit will be handled by Supabase
    NULL;
END;
$$;


ALTER FUNCTION "public"."commit_transaction"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."payment_receipts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "receipt_number" "text" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"(),
    "pdf_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_receipts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_receipt"("payment_id_param" "uuid") RETURNS SETOF "public"."payment_receipts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if receipt already exists
  IF EXISTS (SELECT 1 FROM payment_receipts WHERE payment_id = payment_id_param) THEN
    RETURN QUERY SELECT * FROM payment_receipts WHERE payment_id = payment_id_param;
    RETURN;
  END IF;
  
  -- Create new receipt
  RETURN QUERY
  INSERT INTO payment_receipts (
    payment_id,
    receipt_number,
    issued_at,
    created_at,
    updated_at
  )
  SELECT
    payment_id_param,
    'RECEIPT-' || to_char(now(), 'YYYY') || '-' || LPAD(CAST(nextval('receipt_number_seq') AS TEXT), 5, '0'),
    now(),
    now(),
    now()
  FROM payments
  WHERE id = payment_id_param
  RETURNING *;
END;
$$;


ALTER FUNCTION "public"."create_receipt"("payment_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_storage_policies"("bucket_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Create policy to allow authenticated users to upload their own files
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'authenticated-can-upload-' || bucket_id,
      jsonb_build_object(
        'role', 'authenticated',
        'operation', 'INSERT',
        'check', '(bucket_id = ''' || bucket_id || ''') AND (auth.uid() = storage.foldername(name))'::text
      ),
      bucket_id
    )
    ON CONFLICT (name, bucket_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating upload policy for %: %', bucket_id, SQLERRM;
  END;

  -- Create policy to allow authenticated users to view files
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'authenticated-can-read-' || bucket_id,
      jsonb_build_object(
        'role', 'authenticated',
        'operation', 'SELECT',
        'check', '(bucket_id = ''' || bucket_id || ''') AND (auth.uid() IS NOT NULL)'::text
      ),
      bucket_id
    )
    ON CONFLICT (name, bucket_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating read policy for %: %', bucket_id, SQLERRM;
  END;

  -- Create policy to allow authenticated users to update their own files
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'authenticated-can-update-' || bucket_id,
      jsonb_build_object(
        'role', 'authenticated',
        'operation', 'UPDATE',
        'check', '(bucket_id = ''' || bucket_id || ''') AND (auth.uid() = storage.foldername(name))'::text
      ),
      bucket_id
    )
    ON CONFLICT (name, bucket_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating update policy for %: %', bucket_id, SQLERRM;
  END;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."create_storage_policies"("bucket_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_booking_verification_code"("booking_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_code VARCHAR(6);
  expiry_time TIMESTAMP WITH TIME ZONE;
  affected_rows INTEGER;
BEGIN
  -- Generate a random 6-digit code (letters and numbers)
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ceil(random() * 32)::integer, 1), '')
  INTO new_code
  FROM generate_series(1, 6);
  
  -- Set expiry time to 24 hours from now
  expiry_time := now() + interval '24 hours';
  
  -- Log generated code for debugging
  RAISE NOTICE 'Generated code % for booking %', new_code, booking_id;
  
  -- Update booking with new code and get affected row count
  WITH updated AS (
    UPDATE public.bookings
    SET 
      verification_code = new_code,
      code_verified = FALSE,
      code_expiry = expiry_time,
      updated_at = now()
    WHERE id = booking_id
    RETURNING id
  )
  SELECT count(*) INTO affected_rows FROM updated;
  
  -- Check if update was successful
  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Failed to update booking % with verification code', booking_id;
  END IF;
  
  -- Return the generated code
  RETURN new_code;
END;
$$;


ALTER FUNCTION "public"."generate_booking_verification_code"("booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_receipt_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_val text;
    receipt_num text;
    max_attempts integer := 3;
    current_attempt integer := 0;
BEGIN
    WHILE current_attempt < max_attempts LOOP
        BEGIN
            -- Get next value from sequence
            SELECT nextval('receipt_number_seq') INTO next_val;
            
            -- Format: RECEIPT-YYYY-NNNNN
            receipt_num := 'RECEIPT-' || 
                       to_char(CURRENT_TIMESTAMP, 'YYYY') || '-' ||
                       LPAD(next_val::text, 5, '0');
            
            -- Check if this number is already used
            IF NOT EXISTS (
                SELECT 1 
                FROM public.payment_receipts 
                WHERE receipt_number = receipt_num
            ) THEN
                RETURN receipt_num;
            END IF;
            
            current_attempt := current_attempt + 1;
        END;
    END LOOP;
    
    RAISE EXCEPTION 'Failed to generate unique receipt number after % attempts', max_attempts;
END;
$$;


ALTER FUNCTION "public"."generate_receipt_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_booking_verification_code"("booking_id" "uuid") RETURNS TABLE("verification_code" character varying, "code_expiry" timestamp with time zone, "code_verified" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT b.verification_code, b.code_expiry, b.code_verified
  FROM public.bookings b
  WHERE b.id = booking_id;
END;
$$;


ALTER FUNCTION "public"."get_booking_verification_code"("booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_receipt_by_payment_id"("payment_id_param" "uuid") RETURNS SETOF "public"."payment_receipts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM payment_receipts
  WHERE payment_id = payment_id_param;
END;
$$;


ALTER FUNCTION "public"."get_receipt_by_payment_id"("payment_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    phone, 
    email, 
    full_name,
    city,
    avatar_url,
    is_driver, 
    driver_status, 
    role,
    driver_application_status,
    driver_application_date,
    is_driver_applicant,
    created_by,
    updated_by,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.phone,                    -- Copy phone from auth.users (primary registration method)
    NEW.email,                    -- Copy email from auth.users (if provided)
    NULL,                         -- full_name - null until user updates profile
    NULL,                         -- city - null until user updates profile  
    NULL,                         -- avatar_url - null until user uploads avatar
    false,                        -- is_driver - default to false
    'pending',                    -- driver_status - default to pending
    'user',                       -- role - default to user
    'pending',                    -- driver_application_status - default to pending
    NULL,                         -- driver_application_date - null until they apply
    false,                        -- is_driver_applicant - default to false
    NULL,                         -- created_by - null for self-registration
    NULL,                         -- updated_by - null initially
    NOW(),                        -- created_at - current timestamp
    NOW()                         -- updated_at - current timestamp
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_payment_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO public.payment_logs (payment_id, event_type, event_data)
    VALUES (
        NEW.id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'payment_created'
            WHEN TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN 'status_changed'
            ELSE 'payment_updated'
        END,
        jsonb_build_object(
            'old_data', to_jsonb(OLD),
            'new_data', to_jsonb(NEW),
            'changed_by', auth.uid()
        )
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_payment_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_payment_status"("status" "text") RETURNS "text"
    LANGUAGE "plpgsql"
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
        ELSE 'pending'
    END;
END;
$$;


ALTER FUNCTION "public"."normalize_payment_status"("status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_booking_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_booking_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_booking_status_change"() IS 'Automatically sends notifications when booking status changes, leveraging existing push notification infrastructure';



CREATE OR REPLACE FUNCTION "public"."process_payment_event_queue"("p_batch_size" integer DEFAULT 10) RETURNS TABLE("event_id" "uuid", "payment_id" "uuid", "status" "text", "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event RECORD;
BEGIN
  -- Get pending events that are ready to process
  FOR v_event IN
    SELECT *
    FROM payment_event_queue
    WHERE status IN ('pending', 'failed')
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      AND retry_count < max_retries
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Mark as processing
    UPDATE payment_event_queue
    SET status = 'processing',
        processed_at = NOW()
    WHERE id = v_event.id;
    
    -- Return event for external processing
    RETURN QUERY SELECT 
      v_event.id,
      v_event.payment_id,
      v_event.status,
      NULL::TEXT;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."process_payment_event_queue"("p_batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_payment_event_queue"("p_batch_size" integer) IS 'Batch processes pending payment events';



CREATE OR REPLACE FUNCTION "public"."queue_payment_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_booking_record RECORD;
  v_ride_record RECORD;
  v_user_record RECORD;
  v_driver_record RECORD;
  v_event_data JSONB;
BEGIN
  -- Only process status changes to completed or failed
  IF (TG_OP = 'UPDATE' AND 
      OLD.status IS DISTINCT FROM NEW.status AND 
      NEW.status IN ('completed', 'failed')) THEN
    
    -- Get booking details
    SELECT * INTO v_booking_record
    FROM bookings
    WHERE id = NEW.booking_id;
    
    IF NOT FOUND THEN
      RAISE WARNING 'Booking not found for payment %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Get ride details
    SELECT * INTO v_ride_record
    FROM rides
    WHERE id = v_booking_record.ride_id;
    
    IF NOT FOUND THEN
      RAISE WARNING 'Ride not found for booking %', v_booking_record.id;
      RETURN NEW;
    END IF;
    
    -- Get passenger details
    SELECT id, full_name, phone, email INTO v_user_record
    FROM profiles
    WHERE id = v_booking_record.user_id;
    
    -- Get driver details
    SELECT id, full_name, phone, email INTO v_driver_record
    FROM profiles
    WHERE id = v_ride_record.driver_id;
    
    -- Build comprehensive event data
    v_event_data := jsonb_build_object(
      'payment', jsonb_build_object(
        'id', NEW.id,
        'amount', NEW.amount,
        'provider', NEW.provider,
        'status', NEW.status,
        'transaction_id', NEW.transaction_id
      ),
      'booking', jsonb_build_object(
        'id', v_booking_record.id,
        'seats', v_booking_record.seats,
        'verification_code', v_booking_record.verification_code
      ),
      'ride', jsonb_build_object(
        'id', v_ride_record.id,
        'from_city', v_ride_record.from_city,
        'to_city', v_ride_record.to_city,
        'departure_time', v_ride_record.departure_time,
        'price', v_ride_record.price
      ),
      'passenger', jsonb_build_object(
        'id', v_user_record.id,
        'name', v_user_record.full_name,
        'phone', v_user_record.phone
      ),
      'driver', jsonb_build_object(
        'id', v_driver_record.id,
        'name', v_driver_record.full_name,
        'phone', v_driver_record.phone
      )
    );
    
    -- Queue the event for processing
    INSERT INTO payment_event_queue (
      payment_id,
      event_type,
      event_data,
      next_retry_at
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.status = 'completed' THEN 'payment_completed'
        WHEN NEW.status = 'failed' THEN 'payment_failed'
        ELSE 'payment_status_changed'
      END,
      v_event_data,
      NOW() -- Process immediately
    );
    
    RAISE LOG 'Payment notification queued for payment % with status %', NEW.id, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_payment_notification"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."queue_payment_notification"() IS 'Automatically queues payment notifications when status changes';



CREATE OR REPLACE FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer) RETURNS TABLE("success" boolean, "booking_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_available_seats INTEGER;
  v_booking_id UUID;
  v_ride_driver_id UUID;
BEGIN
  -- Lock the ride row
  SELECT seats_available, driver_id INTO v_available_seats, v_ride_driver_id
  FROM rides
  WHERE id = p_ride_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Ride not found'::TEXT;
    RETURN;
  END IF;
  
  -- Prevent driver from booking their own ride
  IF v_ride_driver_id = p_user_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Driver cannot book their own ride'::TEXT;
    RETURN;
  END IF;
  
  -- Check availability
  IF v_available_seats < p_seats THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 
      format('Only %s seats available, requested %s', v_available_seats, p_seats);
    RETURN;
  END IF;
  
  -- Check for duplicate booking
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
  
  -- Create booking
  INSERT INTO bookings (ride_id, user_id, seats, status, payment_status, created_at, updated_at)
  VALUES (p_ride_id, p_user_id, p_seats, 'pending', 'pending', NOW(), NOW())
  RETURNING id INTO v_booking_id;
  
  IF v_booking_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Failed to create booking'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, v_booking_id, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM::TEXT;
END;
$$;


ALTER FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer) IS 'CREATE MODE: Atomically creates a new booking. Prevents duplicates and race conditions.';



CREATE OR REPLACE FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer, "p_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("success" boolean, "booking_id" "uuid", "error_message" "text")
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
    
    -- Calculate effective available seats
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
$$;


ALTER FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer, "p_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer, "p_booking_id" "uuid") IS 'Atomically reserves/updates seats for a ride by locking the ride row. 
Supports two modes:
- CREATE MODE (booking_id = NULL): Creates new booking, checks for duplicates
- UPDATE MODE (booking_id provided): Updates existing booking, releases old seats before reserving new ones
When updating a paid booking with more seats, sets payment_status to ''partial''.
Prevents seat reduction on paid bookings.
Prevents race conditions where multiple users book the last seat simultaneously.';



CREATE OR REPLACE FUNCTION "public"."rollback_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Nothing needed as rollback will be handled by Supabase
    NULL;
END;
$$;


ALTER FUNCTION "public"."rollback_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_vehicle_storage"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  vehicle_bucket_exists BOOLEAN;
BEGIN
  -- Check if the vehicles bucket exists
  SELECT EXISTS(
    SELECT 1 FROM storage.buckets WHERE name = 'vehicles'
  ) INTO vehicle_bucket_exists;
  
  -- Create the bucket if it doesn't exist
  IF NOT vehicle_bucket_exists THEN
    INSERT INTO storage.buckets (id, name)
    VALUES ('vehicles', 'vehicles');
  END IF;
  
  -- Apply policies to vehicles bucket
  PERFORM create_storage_policies('vehicles');
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."setup_vehicle_storage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_driver_application_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Set application date when status changes to pending
  IF NEW.driver_application_status = 'pending' AND 
     (OLD.driver_application_status IS NULL OR OLD.driver_application_status != 'pending') THEN
    NEW.driver_application_date = NOW();
  END IF;
  
  -- Set is_driver_applicant to true when application status is set
  IF NEW.driver_application_status IS NOT NULL AND 
     (OLD.driver_application_status IS NULL OR OLD.driver_application_status != NEW.driver_application_status) THEN
    NEW.is_driver_applicant = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_driver_application_date"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_and_booking_status"("p_payment_id" "uuid", "p_payment_status" "text", "p_payment_time" timestamp with time zone, "p_metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_booking_id uuid;
    v_normalized_status text;
BEGIN
    -- Log input parameters
    RAISE NOTICE 'Input parameters: payment_id=%, payment_status=%, payment_time=%, metadata=%',
        p_payment_id, p_payment_status, p_payment_time, p_metadata;
    
    -- Normalize the status using our function
    v_normalized_status := normalize_payment_status(p_payment_status);
    RAISE NOTICE 'Normalized status from % to %', p_payment_status, v_normalized_status;

    -- Get the booking ID for this payment
    SELECT booking_id INTO v_booking_id
    FROM payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found: %', p_payment_id;
    END IF;

    -- Update payment status with normalized value
    UPDATE payments
    SET 
        status = v_normalized_status::payment_status,
        payment_time = CASE 
            WHEN v_normalized_status = 'completed' THEN COALESCE(p_payment_time, NOW())
            ELSE payment_time
        END,
        metadata = p_metadata,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- Update booking status if payment is completed or failed
    IF v_normalized_status = 'completed' THEN
        UPDATE bookings
        SET 
            status = 'confirmed',
            payment_status = v_normalized_status::payment_status,
            updated_at = NOW()
        WHERE id = v_booking_id;
    ELSIF v_normalized_status = 'failed' THEN
        UPDATE bookings
        SET 
            status = 'cancelled',
            payment_status = v_normalized_status::payment_status,
            updated_at = NOW()
        WHERE id = v_booking_id;
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in update_payment_and_booking_status: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RAISE NOTICE 'Input status was: %, normalized to: %', p_payment_status, v_normalized_status;
    RAISE;
END;
$$;


ALTER FUNCTION "public"."update_payment_and_booking_status"("p_payment_id" "uuid", "p_payment_status" "text", "p_payment_time" timestamp with time zone, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_event_status"("p_event_id" "uuid", "p_status" "text", "p_error_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_retry_count INT;
  v_next_retry_at TIMESTAMPTZ;
BEGIN
  -- Get current retry count
  SELECT retry_count INTO v_retry_count
  FROM payment_event_queue
  WHERE id = p_event_id;
  
  -- Calculate next retry time with exponential backoff
  IF p_status = 'failed' THEN
    v_next_retry_at := NOW() + (POWER(2, v_retry_count) || ' minutes')::INTERVAL;
  END IF;
  
  -- Update event
  UPDATE payment_event_queue
  SET status = p_status,
      retry_count = v_retry_count + 1,
      next_retry_at = v_next_retry_at,
      error_message = p_error_message,
      processed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE processed_at END
  WHERE id = p_event_id;
END;
$$;


ALTER FUNCTION "public"."update_payment_event_status"("p_event_id" "uuid", "p_status" "text", "p_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payouts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payouts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_driver_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- When a driver document is inserted or updated, only update driver_status to pending
  -- DO NOT set is_driver = TRUE automatically - this should only happen after admin approval
  UPDATE public.profiles
  SET 
    -- Only update driver_status if it's not already set to approved or rejected
    driver_status = CASE 
      WHEN driver_status IN ('approved', 'rejected') THEN driver_status
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = NEW.driver_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_profile_driver_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_push_subscription_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_push_subscription_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_seats_on_booking_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_seats_on_booking_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_seats_on_booking_change"() IS 'Automatically updates seats_available in rides table when bookings are created, updated, or deleted';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    NEW.updated_at = now();
    return NEW;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_message_content"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check for phone numbers
  IF NEW.content ~ '(?:\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}' THEN
    RAISE EXCEPTION 'Message cannot contain phone numbers';
  END IF;

  -- Check for email addresses
  IF NEW.content ~ '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' THEN
    RAISE EXCEPTION 'Message cannot contain email addresses';
  END IF;

  -- Check for URLs
  IF NEW.content ~ '(https?://[^\\s]+)' THEN
    RAISE EXCEPTION 'Message cannot contain URLs';
  END IF;

  -- Check for social media handles
  IF NEW.content ~ '(?:@[\\w_]+|#[\\w_]+)' THEN
    RAISE EXCEPTION 'Message cannot contain social media handles';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_message_content"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_booking_code"("booking_id" "uuid", "submitted_code" character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  booking_record RECORD;
BEGIN
  -- Get the booking record
  SELECT * 
  INTO booking_record
  FROM public.bookings
  WHERE id = booking_id
  AND verification_code = submitted_code
  AND code_expiry > now()
  AND (code_verified IS NULL OR code_verified = FALSE);
  
  -- If no matching record found, return false
  IF booking_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Mark code as verified
  UPDATE public.bookings
  SET code_verified = TRUE
  WHERE id = booking_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."verify_booking_code"("booking_id" "uuid", "submitted_code" character varying) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ride_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "seats" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status",
    "verification_code" character varying(6),
    "code_verified" boolean DEFAULT false,
    "code_expiry" timestamp with time zone
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "full_name" "text",
    "email" "text",
    "city" "text",
    "is_driver" boolean DEFAULT false NOT NULL,
    "driver_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "driver_application_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "driver_application_date" timestamp with time zone,
    "is_driver_applicant" boolean DEFAULT false NOT NULL,
    CONSTRAINT "check_driver_application_status" CHECK (("driver_application_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "check_driver_status" CHECK (("driver_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'inactive'::"text"]))),
    CONSTRAINT "check_role" CHECK (("role" = ANY (ARRAY['user'::"text", 'driver'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."is_driver" IS 'Boolean flag indicating if user is an approved driver';



COMMENT ON COLUMN "public"."profiles"."driver_status" IS 'Detailed driver status: pending, approved, rejected, inactive';



COMMENT ON COLUMN "public"."profiles"."role" IS 'User role: user, driver, admin';



COMMENT ON COLUMN "public"."profiles"."driver_application_status" IS 'Status of driver application: pending, approved, rejected, cancelled';



COMMENT ON COLUMN "public"."profiles"."driver_application_date" IS 'Timestamp when driver application was submitted';



COMMENT ON COLUMN "public"."profiles"."is_driver_applicant" IS 'Boolean flag indicating if user has applied to be a driver';


-- Ensure bookings table has all required columns
DO $$
BEGIN
  -- Add payment_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE "public"."bookings" 
    ADD COLUMN "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status";
  END IF;
  
  -- Add verification_code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name = 'verification_code'
  ) THEN
    ALTER TABLE "public"."bookings" 
    ADD COLUMN "verification_code" character varying(6);
  END IF;
  
  -- Add code_verified column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name = 'code_verified'
  ) THEN
    ALTER TABLE "public"."bookings" 
    ADD COLUMN "code_verified" boolean DEFAULT false;
  END IF;
  
  -- Add code_expiry column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name = 'code_expiry'
  ) THEN
    ALTER TABLE "public"."bookings" 
    ADD COLUMN "code_expiry" timestamp with time zone;
  END IF;
END $$;

CREATE OR REPLACE VIEW "public"."bookings_with_profiles" AS
 SELECT "b"."id",
    "b"."ride_id",
    "b"."user_id",
    "b"."seats",
    "b"."status",
    "b"."created_at",
    "b"."updated_at",
    "b"."payment_status",
    "b"."verification_code",
    "b"."code_verified",
    "b"."code_expiry",
    "p"."full_name",
    "p"."avatar_url"
   FROM ("public"."bookings" "b"
     LEFT JOIN "public"."profiles" "p" ON (("b"."user_id" = "p"."id")));


ALTER TABLE "public"."bookings_with_profiles" OWNER TO "postgres";


COMMENT ON VIEW "public"."bookings_with_profiles" IS 'View that joins bookings with user profile information for easier querying';



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ride_id" "uuid" NOT NULL,
    "participants" "uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid",
    "national_id_number" "text" DEFAULT ''::"text" NOT NULL,
    "license_number" "text" DEFAULT ''::"text" NOT NULL,
    "registration_number" "text" DEFAULT ''::"text" NOT NULL,
    "insurance_number" "text" DEFAULT ''::"text" NOT NULL,
    "road_tax_number" "text",
    "technical_inspection_number" "text" DEFAULT ''::"text" NOT NULL,
    "vehicle_images" "text"[],
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "national_id_file_recto" "text",
    "license_file_recto" "text",
    "registration_file_recto" "text",
    "insurance_file_recto" "text",
    "technical_inspection_file" "text",
    "submission_timestamp" timestamp with time zone DEFAULT "now"(),
    "national_id_file_verso" "text",
    "license_file_verso" "text",
    "registration_file_verso" "text",
    "insurance_file_verso" "text"
);


ALTER TABLE "public"."driver_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."driver_documents" IS 'Contains driver document information including recto/verso (front/back) images for official documents';



COMMENT ON COLUMN "public"."driver_documents"."national_id_file_recto" IS 'URL to front/recto of national ID';



COMMENT ON COLUMN "public"."driver_documents"."license_file_recto" IS 'URL to front/recto of driver license';



COMMENT ON COLUMN "public"."driver_documents"."registration_file_recto" IS 'URL to front/recto of vehicle registration';



COMMENT ON COLUMN "public"."driver_documents"."insurance_file_recto" IS 'URL to front/recto of insurance certificate';



COMMENT ON COLUMN "public"."driver_documents"."national_id_file_verso" IS 'URL to back/verso of national ID';



COMMENT ON COLUMN "public"."driver_documents"."license_file_verso" IS 'URL to back/verso of driver license';



COMMENT ON COLUMN "public"."driver_documents"."registration_file_verso" IS 'URL to back/verso of vehicle registration';



COMMENT ON COLUMN "public"."driver_documents"."insurance_file_verso" IS 'URL to back/verso of insurance certificate';



CREATE TABLE IF NOT EXISTS "public"."driver_profiles" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone_number" "text" NOT NULL,
    "city" "text" NOT NULL,
    "vehicle_model" "text" NOT NULL,
    "vehicle_year" "text" NOT NULL,
    "status" "public"."driver_status" DEFAULT 'PENDING'::"public"."driver_status",
    "rating" numeric(3,2) DEFAULT 0.0,
    "total_trips" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."driver_profiles" OWNER TO "postgres";


ALTER TABLE "public"."driver_profiles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."driver_profiles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "content" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "conversation_id" "uuid" NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "onesignal_id" "text",
    "recipients" integer DEFAULT 0,
    "data" "jsonb",
    "status" "text" DEFAULT 'sent'::"text",
    "delivered_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_logs_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'delivered'::"text", 'clicked'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onesignal_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "notification_id" "text",
    "user_id" "text",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onesignal_webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."passenger_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "national_id_file_recto" "text" NOT NULL,
    "national_id_file_verso" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."passenger_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."passenger_documents" IS 'Contains passenger identification documents (name and ID card front/back)';



COMMENT ON COLUMN "public"."passenger_documents"."national_id_file_recto" IS 'URL to front/recto of national ID card';



COMMENT ON COLUMN "public"."passenger_documents"."national_id_file_verso" IS 'URL to back/verso of national ID card';



CREATE TABLE IF NOT EXISTS "public"."payment_event_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "next_retry_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_event_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."payment_event_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_event_queue" IS 'Reliable queue for async payment event processing with retry logic';



CREATE TABLE IF NOT EXISTS "public"."payment_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid",
    "event_type" character varying(50) NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."payment_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_notification_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "recipient_type" "text" NOT NULL,
    "notification_channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "onesignal_id" "text",
    "attempts" integer DEFAULT 0,
    "last_attempt_at" timestamp with time zone,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_notification_log_notification_channel_check" CHECK (("notification_channel" = ANY (ARRAY['push'::"text", 'sms'::"text", 'email'::"text"]))),
    CONSTRAINT "payment_notification_log_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['payment_initiated'::"text", 'payment_processing'::"text", 'payment_completed'::"text", 'payment_failed'::"text", 'payment_refunded'::"text"]))),
    CONSTRAINT "payment_notification_log_recipient_type_check" CHECK (("recipient_type" = ANY (ARRAY['passenger'::"text", 'driver'::"text"]))),
    CONSTRAINT "payment_notification_log_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'retrying'::"text"])))
);


ALTER TABLE "public"."payment_notification_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_notification_log" IS 'Enterprise audit trail for all payment notifications with idempotency support';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'XAF'::"text" NOT NULL,
    "provider" "text" NOT NULL,
    "phone_number" "text" NOT NULL,
    "transaction_id" "text",
    "payment_time" timestamp with time zone,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status",
    "idempotency_key" "text"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payments"."idempotency_key" IS 'Unique key for idempotent payment operations. Prevents duplicate payment processing when the same request is made multiple times.';



CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "original_amount" numeric(10,2) NOT NULL,
    "transaction_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "commission" numeric(10,2) DEFAULT 0 NOT NULL,
    "currency" character varying(10) DEFAULT 'XAF'::character varying,
    "provider" character varying(20) NOT NULL,
    "phone_number" character varying(20) NOT NULL,
    "transaction_id" character varying(100),
    "status" "public"."payout_status" DEFAULT 'pending'::"public"."payout_status",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "payouts_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payouts_commission_check" CHECK (("commission" >= (0)::numeric)),
    CONSTRAINT "payouts_original_amount_check" CHECK (("original_amount" >= (0)::numeric)),
    CONSTRAINT "payouts_provider_check" CHECK ((("provider")::"text" = ANY ((ARRAY['mtn'::character varying, 'orange'::character varying])::"text"[]))),
    CONSTRAINT "payouts_transaction_fee_check" CHECK (("transaction_fee" >= (0)::numeric))
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


COMMENT ON TABLE "public"."payouts" IS 'Tracks driver payouts when booking codes are verified';



COMMENT ON COLUMN "public"."payouts"."amount" IS 'Driver earnings after fees and commission';



COMMENT ON COLUMN "public"."payouts"."original_amount" IS 'Original passenger payment amount';



COMMENT ON COLUMN "public"."payouts"."transaction_fee" IS 'Transaction fee deducted';



COMMENT ON COLUMN "public"."payouts"."commission" IS 'Platform commission deducted';



COMMENT ON COLUMN "public"."payouts"."transaction_id" IS 'Provider transaction ID (MTN MoMo or Orange Money)';



CREATE OR REPLACE VIEW "public"."profiles_schema_summary" AS
 SELECT "columns"."column_name",
    "columns"."data_type",
    "columns"."is_nullable",
    "columns"."column_default"
   FROM "information_schema"."columns"
  WHERE ((("columns"."table_name")::"name" = 'profiles'::"name") AND (("columns"."table_schema")::"name" = 'public'::"name"))
  ORDER BY "columns"."ordinal_position";


ALTER TABLE "public"."profiles_schema_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "last_used" timestamp with time zone,
    "deactivation_reason" "text"
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."receipt_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."receipt_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "from_city" "text" NOT NULL,
    "to_city" "text" NOT NULL,
    "departure_time" timestamp with time zone NOT NULL,
    "price" numeric NOT NULL,
    "seats_available" integer NOT NULL,
    "car_model" "text",
    "car_color" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text"
);


ALTER TABLE "public"."rides" OWNER TO "postgres";


COMMENT ON TABLE "public"."rides" IS 'seats_available field is now automatically maintained by triggers on the bookings table';

-- Ensure rides table has description column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE "public"."rides" 
    ADD COLUMN "description" "text";
  END IF;
END $$;

COMMENT ON COLUMN "public"."rides"."description" IS 'Optional description for the ride (stops, rules, etc.)';



CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email_notifications" boolean DEFAULT true,
    "sms_notifications" boolean DEFAULT true,
    "whatsapp_notifications" boolean DEFAULT true,
    "language" character varying(10) DEFAULT 'en'::character varying,
    "phone_number" character varying(20),
    "timezone" character varying(50) DEFAULT 'Africa/Douala'::character varying,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "theme" character varying(10) DEFAULT 'system'::character varying
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_settings"."theme" IS 'User theme preference: light, dark, or system';



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_pkey' 
    AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bookings"
      ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_pkey' 
    AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."conversations"
      ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_documents_pkey' 
    AND conrelid = 'public.driver_documents'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."driver_documents"
      ADD CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_profiles_pkey' 
    AND conrelid = 'public.driver_profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."driver_profiles"
      ADD CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_profiles_user_id_key' 
    AND conrelid = 'public.driver_profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."driver_profiles"
      ADD CONSTRAINT "driver_profiles_user_id_key" UNIQUE ("user_id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_pkey' 
    AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."messages"
      ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notification_logs_pkey' 
    AND conrelid = 'public.notification_logs'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."notification_logs"
      ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'onesignal_webhook_logs_pkey' 
    AND conrelid = 'public.onesignal_webhook_logs'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."onesignal_webhook_logs"
      ADD CONSTRAINT "onesignal_webhook_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'passenger_documents_pkey' 
    AND conrelid = 'public.passenger_documents'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."passenger_documents"
      ADD CONSTRAINT "passenger_documents_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'passenger_documents_user_id_key' 
    AND conrelid = 'public.passenger_documents'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."passenger_documents"
      ADD CONSTRAINT "passenger_documents_user_id_key" UNIQUE ("user_id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_event_queue_pkey' 
    AND conrelid = 'public.payment_event_queue'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_event_queue"
      ADD CONSTRAINT "payment_event_queue_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_logs_pkey' 
    AND conrelid = 'public.payment_logs'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_logs"
      ADD CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_notification_log_pkey' 
    AND conrelid = 'public.payment_notification_log'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_notification_log"
      ADD CONSTRAINT "payment_notification_log_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_receipts_payment_id_key' 
    AND conrelid = 'public.payment_receipts'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_receipts"
      ADD CONSTRAINT "payment_receipts_payment_id_key" UNIQUE ("payment_id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_receipts_pkey' 
    AND conrelid = 'public.payment_receipts'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_receipts"
      ADD CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_idempotency_key_key' 
    AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payments"
      ADD CONSTRAINT "payments_idempotency_key_key" UNIQUE ("idempotency_key");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_pkey' 
    AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payments"
      ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_pkey' 
    AND conrelid = 'public.payouts'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payouts"
      ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_pkey' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."profiles"
      ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'push_subscriptions_pkey' 
    AND conrelid = 'public.push_subscriptions'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."push_subscriptions"
      ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'receipt_number_unique' 
    AND conrelid = 'public.payment_receipts'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_receipts"
      ADD CONSTRAINT "receipt_number_unique" UNIQUE ("receipt_number");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rides_pkey' 
    AND conrelid = 'public.rides'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."rides"
      ADD CONSTRAINT "rides_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_user_ride_booking' 
    AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bookings"
      ADD CONSTRAINT "unique_user_ride_booking" UNIQUE ("user_id", "ride_id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_settings_pkey' 
    AND conrelid = 'public.user_settings'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."user_settings"
      ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_settings_user_id_key' 
    AND conrelid = 'public.user_settings'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."user_settings"
      ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");
  END IF;
END $$;



CREATE INDEX "idx_bookings_ride_id" ON "public"."bookings" USING "btree" ("ride_id");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_conversations_ride_id" ON "public"."conversations" USING "btree" ("ride_id");



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");

-- Ensure messages table has read column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'read'
  ) THEN
    ALTER TABLE "public"."messages" 
    ADD COLUMN "read" boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_messages_read" ON "public"."messages" USING "btree" ("read") WHERE ("read" = false);



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_notification_logs_created_at" ON "public"."notification_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notification_logs_notification_type" ON "public"."notification_logs" USING "btree" ("notification_type");



CREATE INDEX "idx_notification_logs_onesignal_id" ON "public"."notification_logs" USING "btree" ("onesignal_id");



CREATE INDEX "idx_notification_logs_status" ON "public"."notification_logs" USING "btree" ("status");



CREATE INDEX "idx_notification_logs_user_id" ON "public"."notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_onesignal_webhook_logs_created_at" ON "public"."onesignal_webhook_logs" USING "btree" ("created_at");



CREATE INDEX "idx_onesignal_webhook_logs_event_type" ON "public"."onesignal_webhook_logs" USING "btree" ("event_type");



CREATE INDEX "idx_onesignal_webhook_logs_user_id" ON "public"."onesignal_webhook_logs" USING "btree" ("user_id");



CREATE INDEX "idx_passenger_documents_user_id" ON "public"."passenger_documents" USING "btree" ("user_id");



CREATE INDEX "idx_payment_event_queue_status" ON "public"."payment_event_queue" USING "btree" ("status", "next_retry_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE INDEX "idx_payment_notification_log_payment_id" ON "public"."payment_notification_log" USING "btree" ("payment_id");



CREATE INDEX "idx_payment_notification_log_recipient" ON "public"."payment_notification_log" USING "btree" ("recipient_id", "recipient_type");



CREATE INDEX "idx_payment_notification_log_status" ON "public"."payment_notification_log" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'retrying'::"text"]));



CREATE INDEX "idx_payments_idempotency_key" ON "public"."payments" USING "btree" ("idempotency_key");



CREATE INDEX "idx_profiles_driver_application_status" ON "public"."profiles" USING "btree" ("driver_application_status");



CREATE INDEX "idx_profiles_driver_status" ON "public"."profiles" USING "btree" ("driver_status");



CREATE INDEX "idx_profiles_is_driver" ON "public"."profiles" USING "btree" ("is_driver");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_push_subscriptions_active" ON "public"."push_subscriptions" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_push_subscriptions_is_active" ON "public"."push_subscriptions" USING "btree" ("is_active");



CREATE INDEX "idx_push_subscriptions_last_used" ON "public"."push_subscriptions" USING "btree" ("last_used");



CREATE INDEX "idx_push_subscriptions_updated_at" ON "public"."push_subscriptions" USING "btree" ("updated_at");



CREATE INDEX "idx_push_subscriptions_user_id" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_receipt_number" ON "public"."payment_receipts" USING "btree" ("receipt_number");



CREATE INDEX "idx_rides_departure" ON "public"."rides" USING "btree" ("departure_time");



CREATE INDEX "idx_rides_driver_id" ON "public"."rides" USING "btree" ("driver_id");



CREATE INDEX "idx_rides_from_to" ON "public"."rides" USING "btree" ("from_city", "to_city");



CREATE INDEX "payment_logs_payment_id_idx" ON "public"."payment_logs" USING "btree" ("payment_id");



CREATE INDEX "payments_booking_id_idx" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "payments_transaction_id_idx" ON "public"."payments" USING "btree" ("transaction_id");



CREATE INDEX "payouts_booking_id_idx" ON "public"."payouts" USING "btree" ("booking_id");



CREATE INDEX "payouts_created_at_idx" ON "public"."payouts" USING "btree" ("created_at" DESC);



CREATE INDEX "payouts_driver_id_idx" ON "public"."payouts" USING "btree" ("driver_id");



CREATE INDEX "payouts_payment_id_idx" ON "public"."payouts" USING "btree" ("payment_id");



CREATE INDEX "payouts_status_idx" ON "public"."payouts" USING "btree" ("status");



CREATE INDEX "payouts_transaction_id_idx" ON "public"."payouts" USING "btree" ("transaction_id");



CREATE OR REPLACE TRIGGER "notify_booking_status_change_trigger" AFTER INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_booking_status_change"();



COMMENT ON TRIGGER "notify_booking_status_change_trigger" ON "public"."bookings" IS 'Triggers notifications for booking status changes';



CREATE OR REPLACE TRIGGER "on_driver_document_change" AFTER INSERT OR UPDATE ON "public"."driver_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_driver_status"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_queue_payment_notification" AFTER UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."queue_payment_notification"();



CREATE OR REPLACE TRIGGER "trigger_update_conversation_updated_at" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_driver_application_date" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_driver_application_date"();



CREATE OR REPLACE TRIGGER "update_driver_profiles_updated_at" BEFORE UPDATE ON "public"."driver_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payouts_updated_at" BEFORE UPDATE ON "public"."payouts" FOR EACH ROW EXECUTE FUNCTION "public"."update_payouts_updated_at"();



CREATE OR REPLACE TRIGGER "update_push_subscription_updated_at" BEFORE UPDATE ON "public"."push_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_push_subscription_updated_at"();



CREATE OR REPLACE TRIGGER "update_seats_on_booking_delete" AFTER DELETE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_seats_on_booking_change"();



COMMENT ON TRIGGER "update_seats_on_booking_delete" ON "public"."bookings" IS 'Updates seats when a booking is deleted';



CREATE OR REPLACE TRIGGER "update_seats_on_booking_insert" AFTER INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_seats_on_booking_change"();



COMMENT ON TRIGGER "update_seats_on_booking_insert" ON "public"."bookings" IS 'Updates seats when a new booking is created';



CREATE OR REPLACE TRIGGER "update_seats_on_booking_update" AFTER UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_seats_on_booking_change"();



COMMENT ON TRIGGER "update_seats_on_booking_update" ON "public"."bookings" IS 'Updates seats when a booking is updated';



CREATE OR REPLACE TRIGGER "update_updated_at_timestamp" BEFORE UPDATE ON "public"."payment_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_ride_id_fkey' 
    AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bookings"
      ADD CONSTRAINT "bookings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_user_id_fkey' 
    AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bookings"
      ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_ride_id_fkey' 
    AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."conversations"
      ADD CONSTRAINT "conversations_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_documents_driver_id_fkey' 
    AND conrelid = 'public.driver_documents'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."driver_documents"
      ADD CONSTRAINT "driver_documents_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_profiles_user_id_fkey' 
    AND conrelid = 'public.driver_profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."driver_profiles"
      ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_conversation_id_fkey' 
    AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."messages"
      ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_sender_id_fkey' 
    AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."messages"
      ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notification_logs_user_id_fkey' 
    AND conrelid = 'public.notification_logs'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."notification_logs"
      ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'passenger_documents_user_id_fkey' 
    AND conrelid = 'public.passenger_documents'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."passenger_documents"
      ADD CONSTRAINT "passenger_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_event_queue_payment_id_fkey' 
    AND conrelid = 'public.payment_event_queue'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_event_queue"
      ADD CONSTRAINT "payment_event_queue_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_notification_log_payment_id_fkey' 
    AND conrelid = 'public.payment_notification_log'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_notification_log"
      ADD CONSTRAINT "payment_notification_log_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_receipts_payment_id_fkey' 
    AND conrelid = 'public.payment_receipts'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payment_receipts"
      ADD CONSTRAINT "payment_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_booking_id_fkey' 
    AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payments"
      ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_booking_id_fkey' 
    AND conrelid = 'public.payouts'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payouts"
      ADD CONSTRAINT "payouts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_driver_id_fkey' 
    AND conrelid = 'public.payouts'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payouts"
      ADD CONSTRAINT "payouts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payouts_payment_id_fkey' 
    AND conrelid = 'public.payouts'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payouts"
      ADD CONSTRAINT "payouts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_created_by_fkey' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."profiles"
      ADD CONSTRAINT "profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_id_fkey' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."profiles"
      ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_updated_by_fkey' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."profiles"
      ADD CONSTRAINT "profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'push_subscriptions_user_id_fkey' 
    AND conrelid = 'public.push_subscriptions'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."push_subscriptions"
      ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rides_driver_id_fkey' 
    AND conrelid = 'public.rides'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."rides"
      ADD CONSTRAINT "rides_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_settings_user_id_fkey' 
    AND conrelid = 'public.user_settings'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."user_settings"
      ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;



CREATE POLICY "Admin access to driver documents" ON "public"."driver_documents" TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can read all driver documents" ON "public"."driver_documents" FOR SELECT TO "authenticated" USING ((((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ("auth"."uid"() = "driver_id")));



CREATE POLICY "Admins can update all driver documents" ON "public"."driver_documents" FOR UPDATE TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update driver documents" ON "public"."driver_documents" FOR UPDATE USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all driver documents" ON "public"."driver_documents" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Allow trigger to insert logs" ON "public"."payment_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Anyone can view driver profiles" ON "public"."driver_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view rides" ON "public"."rides" FOR SELECT USING (true);



CREATE POLICY "Anyone can view vehicle images" ON "public"."driver_documents" FOR SELECT USING (true);



CREATE POLICY "Drivers can create their own rides" ON "public"."rides" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can delete their own rides" ON "public"."rides" FOR DELETE USING (("auth"."uid"() = "driver_id"));



COMMENT ON POLICY "Drivers can delete their own rides" ON "public"."rides" IS 'Allows authenticated drivers to delete rides they created';



CREATE POLICY "Drivers can insert their own documents" ON "public"."driver_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can update their own documents" ON "public"."driver_documents" FOR UPDATE USING (("auth"."uid"() = "driver_id"));



CREATE POLICY "Drivers can update their own profiles" ON "public"."driver_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Drivers can update their own rides" ON "public"."rides" FOR UPDATE USING (("auth"."uid"() = "driver_id"));



COMMENT ON POLICY "Drivers can update their own rides" ON "public"."rides" IS 'Allows authenticated drivers to update rides they created';



CREATE POLICY "Drivers can update verification status" ON "public"."bookings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."rides"
  WHERE (("rides"."id" = "bookings"."ride_id") AND ("rides"."driver_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rides"
  WHERE (("rides"."id" = "bookings"."ride_id") AND ("rides"."driver_id" = "auth"."uid"())))));



CREATE POLICY "Drivers can view bookings for their rides" ON "public"."bookings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."rides"
  WHERE (("rides"."id" = "bookings"."ride_id") AND ("rides"."driver_id" = "auth"."uid"())))));



CREATE POLICY "Drivers can view their own payouts" ON "public"."payouts" FOR SELECT TO "authenticated" USING (("driver_id" = "auth"."uid"()));



CREATE POLICY "Enable all access for authenticated users" ON "public"."payment_receipts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access for authenticated users" ON "public"."payments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can insert webhook logs" ON "public"."onesignal_webhook_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role has full access to payment_event_queue" ON "public"."payment_event_queue" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to payment_notification_log" ON "public"."payment_notification_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "System can insert payouts" ON "public"."payouts" FOR INSERT TO "authenticated" WITH CHECK (("driver_id" = "auth"."uid"()));



CREATE POLICY "System can update payouts" ON "public"."payouts" FOR UPDATE TO "authenticated" USING (("driver_id" = "auth"."uid"())) WITH CHECK (("driver_id" = "auth"."uid"()));



CREATE POLICY "Users and drivers can view relevant bookings" ON "public"."bookings" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."rides"
  WHERE (("rides"."id" = "bookings"."ride_id") AND ("rides"."driver_id" = "auth"."uid"()))))));

-- Ensure conversations table has participants column
DO $$
BEGIN
  -- Only proceed if the conversations table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'conversations' 
      AND column_name = 'participants'
      AND table_schema = 'public'
    ) THEN
      ALTER TABLE "public"."conversations" 
      ADD COLUMN "participants" "uuid"[];
      -- Initialize participants from conversation_participants if that table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_participants' AND table_schema = 'public') THEN
        EXECUTE 'UPDATE public.conversations c
        SET participants = COALESCE(
          (SELECT ARRAY_AGG(user_id)
           FROM public.conversation_participants cp
           WHERE cp.conversation_id = c.id),
          ARRAY[]::UUID[]
        )
        WHERE participants IS NULL';
      ELSE
        EXECUTE 'UPDATE public.conversations SET participants = ARRAY[]::UUID[] WHERE participants IS NULL';
      END IF;
      ALTER TABLE "public"."conversations" ALTER COLUMN "participants" SET DEFAULT ARRAY[]::UUID[];
      ALTER TABLE "public"."conversations" ALTER COLUMN "participants" SET NOT NULL;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Silently ignore if table doesn't exist or other errors
  NULL;
END $$;

DROP POLICY IF EXISTS "Users can create conversations they're part of" ON "public"."conversations";
CREATE POLICY "Users can create conversations they're part of" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = ANY ("participants")));



CREATE POLICY "Users can delete their own bookings" ON "public"."bookings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own push subscriptions" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own webhook logs" ON "public"."onesignal_webhook_logs" FOR SELECT TO "authenticated" USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can see their own documents" ON "public"."driver_documents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "driver_id"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can submit their own driver documents" ON "public"."driver_documents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "driver_id"));



CREATE POLICY "Users can update messages they sent" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "sender_id")) WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can update their own bookings" ON "public"."bookings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



DROP POLICY IF EXISTS "Users can view their conversations" ON "public"."conversations";
CREATE POLICY "Users can view their conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = ANY ("participants")));



CREATE POLICY "Users can view their own payment logs" ON "public"."payment_logs" FOR SELECT USING (("auth"."uid"() IN ( SELECT "b"."user_id"
   FROM ("public"."bookings" "b"
     JOIN "public"."payments" "p" ON (("p"."booking_id" = "b"."id")))
  WHERE ("p"."id" = "payment_logs"."payment_id"))));



CREATE POLICY "Users can view their own payments" ON "public"."payments" FOR SELECT USING (("booking_id" IN ( SELECT "bookings"."id"
   FROM "public"."bookings"
  WHERE ("bookings"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own receipts" ON "public"."payment_receipts" FOR SELECT USING (("payment_id" IN ( SELECT "p"."id"
   FROM ("public"."payments" "p"
     JOIN "public"."bookings" "b" ON (("p"."booking_id" = "b"."id")))
  WHERE ("b"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their payment notifications" ON "public"."payment_notification_log" FOR SELECT TO "authenticated" USING ((("recipient_id" = "auth"."uid"()) OR ("payment_id" IN ( SELECT "p"."id"
   FROM ("public"."payments" "p"
     JOIN "public"."bookings" "b" ON (("p"."booking_id" = "b"."id")))
  WHERE ("b"."user_id" = "auth"."uid"())))));



CREATE POLICY "admins_select_passengers" ON "public"."passenger_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_by_participants" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("auth"."uid"() = ANY ("c"."participants")))))));



CREATE POLICY "messages_select_by_participants" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("auth"."uid"() = ANY ("c"."participants"))))));



CREATE POLICY "messages_update_by_participants" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("auth"."uid"() = ANY ("c"."participants")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("auth"."uid"() = ANY ("c"."participants"))))));



ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_logs_insert_service" ON "public"."notification_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "notification_logs_select_own" ON "public"."notification_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_logs_update_service" ON "public"."notification_logs" FOR UPDATE USING (true);



ALTER TABLE "public"."onesignal_webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."passenger_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "passengers_insert_own" ON "public"."passenger_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "passengers_select_own" ON "public"."passenger_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "passengers_update_own" ON "public"."passenger_documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."payment_event_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_notification_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_policy" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_policy" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_update_policy" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_booking_and_restore_seats"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_booking_and_restore_seats"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_booking_and_restore_seats"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_payment_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_payment_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_payment_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "service_role";



GRANT ALL ON TABLE "public"."payment_receipts" TO "anon";
GRANT ALL ON TABLE "public"."payment_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_receipts" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_receipt"("payment_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_receipt"("payment_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_receipt"("payment_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_storage_policies"("bucket_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_storage_policies"("bucket_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_storage_policies"("bucket_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_booking_verification_code"("booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_booking_verification_code"("booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_verification_code"("booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_receipt_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_receipt_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_receipt_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_booking_verification_code"("booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_booking_verification_code"("booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booking_verification_code"("booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_receipt_by_payment_id"("payment_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_receipt_by_payment_id"("payment_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_receipt_by_payment_id"("payment_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_payment_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_payment_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_payment_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_payment_status"("status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_payment_status"("status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_payment_status"("status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_booking_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_booking_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_booking_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_payment_event_queue"("p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_payment_event_queue"("p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_payment_event_queue"("p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_payment_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_payment_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_payment_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer, "p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer, "p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_ride_seats"("p_ride_id" "uuid", "p_user_id" "uuid", "p_seats" integer, "p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."setup_vehicle_storage"() TO "anon";
GRANT ALL ON FUNCTION "public"."setup_vehicle_storage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_vehicle_storage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_driver_application_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_driver_application_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_driver_application_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_and_booking_status"("p_payment_id" "uuid", "p_payment_status" "text", "p_payment_time" timestamp with time zone, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_and_booking_status"("p_payment_id" "uuid", "p_payment_status" "text", "p_payment_time" timestamp with time zone, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_and_booking_status"("p_payment_id" "uuid", "p_payment_status" "text", "p_payment_time" timestamp with time zone, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_event_status"("p_event_id" "uuid", "p_status" "text", "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_event_status"("p_event_id" "uuid", "p_status" "text", "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_event_status"("p_event_id" "uuid", "p_status" "text", "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payouts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payouts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payouts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_driver_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_driver_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_driver_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_push_subscription_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_push_subscription_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_push_subscription_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_seats_on_booking_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_seats_on_booking_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_seats_on_booking_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_message_content"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_message_content"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_message_content"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_booking_code"("booking_id" "uuid", "submitted_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."verify_booking_code"("booking_id" "uuid", "submitted_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_booking_code"("booking_id" "uuid", "submitted_code" character varying) TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."bookings_with_profiles" TO "anon";
GRANT ALL ON TABLE "public"."bookings_with_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings_with_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."driver_documents" TO "anon";
GRANT ALL ON TABLE "public"."driver_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_documents" TO "service_role";



GRANT ALL ON TABLE "public"."driver_profiles" TO "anon";
GRANT ALL ON TABLE "public"."driver_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."driver_profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."driver_profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."driver_profiles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."onesignal_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."onesignal_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."onesignal_webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."passenger_documents" TO "anon";
GRANT ALL ON TABLE "public"."passenger_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."passenger_documents" TO "service_role";



GRANT ALL ON TABLE "public"."payment_event_queue" TO "anon";
GRANT ALL ON TABLE "public"."payment_event_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_event_queue" TO "service_role";



GRANT ALL ON TABLE "public"."payment_logs" TO "anon";
GRANT ALL ON TABLE "public"."payment_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_logs" TO "service_role";



GRANT ALL ON TABLE "public"."payment_notification_log" TO "anon";
GRANT ALL ON TABLE "public"."payment_notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_notification_log" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_schema_summary" TO "anon";
GRANT ALL ON TABLE "public"."profiles_schema_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_schema_summary" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receipt_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receipt_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receipt_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rides" TO "anon";
GRANT ALL ON TABLE "public"."rides" TO "authenticated";
GRANT ALL ON TABLE "public"."rides" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






