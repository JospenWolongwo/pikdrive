-- Start a transaction
BEGIN;

-- Drop the existing enum if it exists
DROP TYPE IF EXISTS payment_status CASCADE;

-- Create the enum type with our desired values
CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded'
);

-- Function to normalize payment status
CREATE OR REPLACE FUNCTION normalize_payment_status(status text) 
RETURNS text AS $$
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
$$ LANGUAGE plpgsql;

-- Function to update seats after payment
CREATE OR REPLACE FUNCTION update_seats_after_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if this is an UPDATE and status changed to completed
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
        -- Update seats_available in rides table
        UPDATE rides
        SET seats_available = seats_available - (
            SELECT seats 
            FROM bookings 
            WHERE id = NEW.booking_id
        )
        WHERE id = (
            SELECT ride_id 
            FROM bookings 
            WHERE id = NEW.booking_id
        );
        
        RAISE NOTICE 'Updated seats for booking: %', NEW.booking_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or update tables
DO $$
DECLARE
    orphaned_count integer;
BEGIN
    -- Backup existing payments data if table exists
    CREATE TEMP TABLE IF NOT EXISTS payments_backup AS
    SELECT * FROM payments WHERE EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'payments'
    );

    -- Backup existing bookings data if table exists
    CREATE TEMP TABLE IF NOT EXISTS bookings_backup AS
    SELECT * FROM bookings WHERE EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'bookings'
    );

    -- Create temp table for valid payments (those with existing bookings)
    CREATE TEMP TABLE IF NOT EXISTS valid_payments AS
    SELECT p.* 
    FROM payments_backup p
    INNER JOIN bookings_backup b ON p.booking_id = b.id;

    -- Drop existing tables if they exist
    DROP TABLE IF EXISTS payments CASCADE;
    DROP TABLE IF EXISTS payment_receipts CASCADE;
    DROP TABLE IF EXISTS bookings CASCADE;

    -- Create bookings table first (since payments will reference it)
    CREATE TABLE bookings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        ride_id uuid NOT NULL REFERENCES rides(id),
        user_id uuid NOT NULL,
        seats integer NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        payment_status payment_status NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
    );

    -- Create payments table with foreign key to bookings
    CREATE TABLE payments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id uuid NOT NULL,
        amount numeric(10,2) NOT NULL,
        currency text NOT NULL DEFAULT 'XAF',
        provider text NOT NULL,
        phone_number text NOT NULL,
        transaction_id text,
        payment_time timestamptz,
        metadata jsonb,
        status payment_status NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) 
            REFERENCES bookings(id) ON DELETE CASCADE
    );

    -- Create payment_receipts table
    CREATE TABLE payment_receipts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        payment_id uuid NOT NULL REFERENCES payments(id),
        created_at timestamptz NOT NULL DEFAULT NOW()
    );

    -- Restore backed up bookings data first
    INSERT INTO bookings (
        id, ride_id, user_id, seats, status, 
        payment_status, created_at, updated_at
    )
    SELECT 
        id, ride_id, user_id, seats, status,
        'pending'::payment_status as payment_status,
        COALESCE(created_at, NOW()) as created_at,
        COALESCE(updated_at, NOW()) as updated_at
    FROM bookings_backup
    ON CONFLICT (id) DO NOTHING;

    -- Then restore only valid payments data
    INSERT INTO payments (
        id, booking_id, amount, currency, provider, 
        phone_number, transaction_id, payment_time, metadata,
        status, created_at, updated_at
    )
    SELECT 
        id, booking_id, amount, currency, provider,
        phone_number, transaction_id, payment_time, metadata,
        'pending'::payment_status as status,
        COALESCE(created_at, NOW()) as created_at,
        COALESCE(updated_at, NOW()) as updated_at
    FROM valid_payments
    ON CONFLICT (id) DO NOTHING;

    -- Log orphaned payments for review
    WITH orphaned_payments AS (
        SELECT p.* 
        FROM payments_backup p
        LEFT JOIN bookings_backup b ON p.booking_id = b.id
        WHERE b.id IS NULL
    )
    SELECT count(*) INTO orphaned_count 
    FROM orphaned_payments;

    RAISE NOTICE 'Found % orphaned payments that were not restored', orphaned_count;

    -- Create or replace the trigger
    DROP TRIGGER IF EXISTS update_seats_after_payment_trigger ON payments;
    CREATE TRIGGER update_seats_after_payment_trigger
        AFTER UPDATE ON payments
        FOR EACH ROW
        EXECUTE FUNCTION update_seats_after_payment();

    -- Drop temporary tables
    DROP TABLE IF EXISTS payments_backup;
    DROP TABLE IF EXISTS bookings_backup;
    DROP TABLE IF EXISTS valid_payments;

    RAISE NOTICE 'All tables, columns, and triggers created/updated successfully';
END $$;

-- Function to update payment and booking status atomically
CREATE OR REPLACE FUNCTION update_payment_and_booking_status(
    p_payment_id uuid,
    p_payment_status text,
    p_payment_time timestamptz,
    p_metadata jsonb
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

COMMIT;
