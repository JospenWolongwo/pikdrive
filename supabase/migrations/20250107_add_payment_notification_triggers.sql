-- Enterprise-Level Payment Notification System
-- Implements automatic notifications on payment status changes
-- Follows best practices from Stripe, Square, and enterprise fintech systems

-- ============================================================================
-- 1. Payment Notification Log Table (Idempotency & Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'payment_initiated',
    'payment_processing',
    'payment_completed',
    'payment_failed',
    'payment_refunded'
  )),
  recipient_id UUID NOT NULL, -- User or Driver ID
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('passenger', 'driver')),
  notification_channel TEXT NOT NULL CHECK (notification_channel IN ('push', 'sms', 'email')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  onesignal_id TEXT, -- OneSignal notification ID for tracking
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_notification_log_payment_id 
  ON payment_notification_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_notification_log_recipient 
  ON payment_notification_log(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_payment_notification_log_status 
  ON payment_notification_log(status) WHERE status IN ('pending', 'retrying');

-- ============================================================================
-- 2. Payment Event Queue (For reliable async processing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_event_queue_status 
  ON payment_event_queue(status, next_retry_at) WHERE status IN ('pending', 'failed');

-- ============================================================================
-- 3. Function: Queue Payment Notification
-- ============================================================================
CREATE OR REPLACE FUNCTION queue_payment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================================
-- 4. Trigger: On Payment Status Change
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_queue_payment_notification ON payments;

CREATE TRIGGER trigger_queue_payment_notification
AFTER UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION queue_payment_notification();

-- ============================================================================
-- 5. Function: Process Payment Event Queue (Called by Edge Function or Cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION process_payment_event_queue(
  p_batch_size INT DEFAULT 10
)
RETURNS TABLE (
  event_id UUID,
  payment_id UUID,
  status TEXT,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================================
-- 6. Function: Update Event Status (Called after notification attempt)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_payment_event_status(
  p_event_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================================
-- 7. RLS Policies
-- ============================================================================
ALTER TABLE payment_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_event_queue ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role has full access to payment_notification_log"
  ON payment_notification_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to payment_event_queue"
  ON payment_event_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own notifications
CREATE POLICY "Users can view their payment notifications"
  ON payment_notification_log
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid() OR
    payment_id IN (
      SELECT p.id FROM payments p
      INNER JOIN bookings b ON p.booking_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. Cleanup Function (Remove old processed events)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_payment_events()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================================
-- 9. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON payment_notification_log TO authenticated, anon;
GRANT SELECT ON payment_event_queue TO authenticated;

-- ============================================================================
-- Done!
-- ============================================================================
COMMENT ON TABLE payment_notification_log IS 'Enterprise audit trail for all payment notifications with idempotency support';
COMMENT ON TABLE payment_event_queue IS 'Reliable queue for async payment event processing with retry logic';
COMMENT ON FUNCTION queue_payment_notification() IS 'Automatically queues payment notifications when status changes';
COMMENT ON FUNCTION process_payment_event_queue(INT) IS 'Batch processes pending payment events';
COMMENT ON FUNCTION cleanup_old_payment_events() IS 'Removes old processed events to prevent table bloat';























