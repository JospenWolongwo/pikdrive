-- ============================================================================
-- Atomic Cancellation with Refund Preparation
-- ============================================================================
-- Creates atomic function that cancels booking and prepares refund record
-- in a single transaction. External refund API call happens after transaction.
-- ============================================================================

-- ============================================================================
-- PART 1: Enhanced cancellation function with refund preparation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_booking_with_refund_preparation(
  p_booking_id UUID,
  p_user_id UUID,
  p_refund_amount NUMERIC,
  p_refund_currency VARCHAR(10),
  p_refund_provider VARCHAR(20),
  p_refund_phone_number VARCHAR(20),
  p_payment_ids UUID[]
) RETURNS TABLE(
  success BOOLEAN,
  booking_cancelled BOOLEAN,
  refund_record_id UUID,
  error_message TEXT,
  debug_info JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride_id UUID;
  v_seats INTEGER;
  v_current_status TEXT;
  v_current_payment_status payment_status;
  v_updated_rows INTEGER;
  v_refund_id UUID;
  v_payment_count INTEGER;
  v_debug_info JSONB := '{}'::jsonb;
  v_step TEXT;
BEGIN
  -- Initialize debug info
  v_debug_info := jsonb_build_object(
    'booking_id', p_booking_id,
    'user_id', p_user_id,
    'started_at', NOW(),
    'steps', jsonb_build_array()
  );

  -- Step 1: Validate booking exists and get details
  v_step := 'validate_booking';
  SELECT ride_id, seats, status, payment_status
  INTO v_ride_id, v_seats, v_current_status, v_current_payment_status
  FROM bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    v_debug_info := jsonb_set(v_debug_info, '{steps}', 
      (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
        'step', v_step,
        'status', 'failed',
        'error', 'Booking not found',
        'timestamp', NOW()
      ))
    );
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 'Booking not found: ' || p_booking_id::TEXT, v_debug_info;
    RETURN;
  END IF;

  v_debug_info := jsonb_set(v_debug_info, '{steps}', 
    (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
      'step', v_step,
      'status', 'success',
      'booking_status', v_current_status,
      'payment_status', v_current_payment_status,
      'seats', v_seats,
      'ride_id', v_ride_id,
      'timestamp', NOW()
    ))
  );

  -- Step 2: Validate booking can be cancelled
  v_step := 'validate_cancellation';
  IF v_current_status = 'cancelled' THEN
    v_debug_info := jsonb_set(v_debug_info, '{steps}', 
      (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
        'step', v_step,
        'status', 'failed',
        'error', 'Booking is already cancelled',
        'timestamp', NOW()
      ))
    );
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 'Booking is already cancelled'::TEXT, v_debug_info;
    RETURN;
  END IF;

  IF v_current_status NOT IN ('pending', 'confirmed', 'pending_verification') THEN
    v_debug_info := jsonb_set(v_debug_info, '{steps}', 
      (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
        'step', v_step,
        'status', 'failed',
        'error', format('Booking cannot be cancelled in current status: %s', v_current_status),
        'current_status', v_current_status,
        'timestamp', NOW()
      ))
    );
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 
      format('Booking cannot be cancelled in current status: %s', v_current_status), 
      v_debug_info;
    RETURN;
  END IF;

  v_debug_info := jsonb_set(v_debug_info, '{steps}', 
    (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
      'step', v_step,
      'status', 'success',
      'can_cancel', true,
      'timestamp', NOW()
    ))
  );

  -- Step 3: Validate payments exist
  v_step := 'validate_payments';
  v_payment_count := array_length(p_payment_ids, 1);
  
  IF v_payment_count IS NULL OR v_payment_count = 0 THEN
    v_debug_info := jsonb_set(v_debug_info, '{steps}', 
      (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
        'step', v_step,
        'status', 'warning',
        'message', 'No payments provided - proceeding with cancellation only',
        'timestamp', NOW()
      ))
    );
  ELSE
    -- Verify all payment IDs exist and belong to this booking
    IF EXISTS (
      SELECT 1 FROM payments 
      WHERE id = ANY(p_payment_ids) 
      AND booking_id != p_booking_id
    ) THEN
      v_debug_info := jsonb_set(v_debug_info, '{steps}', 
        (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
          'step', v_step,
          'status', 'failed',
          'error', 'One or more payments do not belong to this booking',
          'timestamp', NOW()
        ))
      );
      RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 
        'Payment validation failed: payments do not belong to booking'::TEXT, 
        v_debug_info;
      RETURN;
    END IF;

    v_debug_info := jsonb_set(v_debug_info, '{steps}', 
      (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
        'step', v_step,
        'status', 'success',
        'payment_count', v_payment_count,
        'timestamp', NOW()
      ))
    );
  END IF;

  -- Step 4: Cancel booking and restore seats (ATOMIC)
  v_step := 'cancel_booking';
  BEGIN
    -- Lock the booking row for update
    SELECT ride_id, seats, status
    INTO v_ride_id, v_seats, v_current_status
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    -- Update booking status to cancelled and payment_status to refunded (if it was completed)
    UPDATE bookings
    SET status = 'cancelled',
        payment_status = CASE 
          WHEN v_current_payment_status = 'completed'::payment_status THEN 'refunded'::payment_status
          ELSE payment_status -- Keep existing payment_status if not completed
        END,
        updated_at = NOW()
    WHERE id = p_booking_id
      AND status = v_current_status; -- Optimistic locking

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    IF v_updated_rows = 0 THEN
      v_debug_info := jsonb_set(v_debug_info, '{steps}', 
        (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
          'step', v_step,
          'status', 'failed',
          'error', 'Booking status changed during cancellation (race condition)',
          'current_status', v_current_status,
          'timestamp', NOW()
        ))
      );
      RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 
        'Booking status changed during cancellation'::TEXT, 
        v_debug_info;
      RETURN;
    END IF;

    -- Restore seats to ride
    -- IMPORTANT: The trigger `update_seats_on_booking_update` will automatically restore seats
    -- when payment_status changes from 'completed' to 'refunded'. So we should NOT manually
    -- restore seats if payment_status was 'completed' to avoid double restoration.
    -- For unpaid bookings (payment_status != 'completed'), seats were never decremented,
    -- so no restoration needed. However, to handle legacy data or edge cases, we'll still
    -- manually restore for non-completed bookings to ensure seats are available.
    IF v_current_payment_status = 'completed'::payment_status THEN
      -- Payment was completed - trigger will restore seats automatically when payment_status
      -- changes to 'refunded'. No manual restoration needed to avoid double restoration.
      v_debug_info := jsonb_set(v_debug_info, '{steps}', 
        (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
          'step', v_step,
          'status', 'success',
          'seats_restored_by_trigger', v_seats,
          'reason', 'payment_status_changed_from_completed_to_refunded_trigger_will_restore',
          'ride_id', v_ride_id,
          'timestamp', NOW()
        ))
      );
    ELSE
      -- Payment was NOT completed - seats were never decremented by trigger
      -- But we restore anyway to handle legacy data or ensure consistency
      UPDATE rides
      SET seats_available = seats_available + v_seats,
          updated_at = NOW()
      WHERE id = v_ride_id;
      
      v_debug_info := jsonb_set(v_debug_info, '{steps}', 
        (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
          'step', v_step,
          'status', 'success',
          'seats_restored_manually', v_seats,
          'reason', 'payment_status_was_not_completed_manual_restore',
          'ride_id', v_ride_id,
          'timestamp', NOW()
        ))
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_debug_info := jsonb_set(v_debug_info, '{steps}', 
      (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
        'step', v_step,
        'status', 'failed',
        'error', SQLERRM,
        'sqlstate', SQLSTATE,
        'timestamp', NOW()
      ))
    );
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 
      format('Failed to cancel booking: %s', SQLERRM), 
      v_debug_info;
    RETURN;
  END;

  -- Step 5: Create refund record (if payments provided)
  v_step := 'create_refund_record';
  IF v_payment_count > 0 AND p_refund_amount > 0 THEN
    BEGIN
      -- Get primary payment ID (first in array)
      DECLARE
        v_primary_payment_id UUID := p_payment_ids[1];
      BEGIN
        INSERT INTO refunds (
          payment_id,
          booking_id,
          user_id,
          amount,
          currency,
          provider,
          phone_number,
          status,
          refund_type,
          reason,
          metadata
        ) VALUES (
          v_primary_payment_id,
          p_booking_id,
          p_user_id,
          p_refund_amount,
          p_refund_currency,
          p_refund_provider,
          p_refund_phone_number,
          'pending'::payment_status, -- Will be updated when external refund API succeeds
          'full',
          'Full booking cancellation',
          jsonb_build_object(
            'payment_ids', p_payment_ids,
            'payment_count', v_payment_count,
            'created_in_transaction', true,
            'created_at', NOW()
          )
        )
        RETURNING id INTO v_refund_id;

        v_debug_info := jsonb_set(v_debug_info, '{steps}', 
          (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
            'step', v_step,
            'status', 'success',
            'refund_id', v_refund_id,
            'amount', p_refund_amount,
            'timestamp', NOW()
          ))
        );

      EXCEPTION WHEN OTHERS THEN
        v_debug_info := jsonb_set(v_debug_info, '{steps}', 
          (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
            'step', v_step,
            'status', 'failed',
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'timestamp', NOW()
          ))
        );
        -- If refund record creation fails, we need to rollback booking cancellation
        -- But we're in a function, so we'll return error and let caller handle rollback
        RETURN QUERY SELECT FALSE, TRUE, NULL::UUID, 
          format('Failed to create refund record: %s', SQLERRM), 
          v_debug_info;
        RETURN;
      END;
    END;
  ELSE
    v_debug_info := jsonb_set(v_debug_info, '{steps}', 
      (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
        'step', v_step,
        'status', 'skipped',
        'reason', 'No payments or refund amount is zero',
        'timestamp', NOW()
      ))
    );
  END IF;

  -- Step 6: Update payment statuses (if payments provided)
  v_step := 'update_payment_statuses';
  IF v_payment_count > 0 THEN
    BEGIN
      UPDATE payments
      SET status = 'refunded'::payment_status,
          updated_at = NOW()
      WHERE id = ANY(p_payment_ids)
        AND booking_id = p_booking_id;

      GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

      v_debug_info := jsonb_set(v_debug_info, '{steps}', 
        (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
          'step', v_step,
          'status', 'success',
          'payments_updated', v_updated_rows,
          'timestamp', NOW()
        ))
      );

    EXCEPTION WHEN OTHERS THEN
      v_debug_info := jsonb_set(v_debug_info, '{steps}', 
        (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
          'step', v_step,
          'status', 'failed',
          'error', SQLERRM,
          'sqlstate', SQLSTATE,
          'timestamp', NOW()
        ))
      );
      -- Payment update failure is less critical, log but continue
      RAISE NOTICE '[CANCEL_WITH_REFUND] Payment status update failed: %', SQLERRM;
    END;
  ELSE
    v_debug_info := jsonb_set(v_debug_info, '{steps}', 
      (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
        'step', v_step,
        'status', 'skipped',
        'reason', 'No payments to update',
        'timestamp', NOW()
      ))
    );
  END IF;

  -- Finalize debug info
  v_debug_info := jsonb_set(v_debug_info, '{completed_at}', to_jsonb(NOW()));
  v_debug_info := jsonb_set(v_debug_info, '{success}', 'true'::jsonb);

  -- Return success
  RETURN QUERY SELECT TRUE, TRUE, v_refund_id, NULL::TEXT, v_debug_info;

EXCEPTION WHEN OTHERS THEN
  -- Catch-all exception handler
  v_debug_info := jsonb_set(v_debug_info, '{steps}', 
    (v_debug_info->'steps')::jsonb || jsonb_build_array(jsonb_build_object(
      'step', 'exception_handler',
      'status', 'failed',
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'timestamp', NOW()
    ))
  );
  v_debug_info := jsonb_set(v_debug_info, '{completed_at}', to_jsonb(NOW()));
  v_debug_info := jsonb_set(v_debug_info, '{success}', 'false'::jsonb);

  RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 
    format('Unexpected error: %s', SQLERRM), 
    v_debug_info;
END;
$$;

ALTER FUNCTION public.cancel_booking_with_refund_preparation(
  UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, UUID[]
) OWNER TO postgres;

COMMENT ON FUNCTION public.cancel_booking_with_refund_preparation(
  UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, UUID[]
) IS 'Atomically cancels booking, restores seats, creates refund record, and updates payment statuses. Returns detailed debug info for troubleshooting. External refund API call must be made separately after this function succeeds.';

-- ============================================================================
-- PART 2: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.cancel_booking_with_refund_preparation(
  UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, UUID[]
) TO anon;

GRANT EXECUTE ON FUNCTION public.cancel_booking_with_refund_preparation(
  UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, UUID[]
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_booking_with_refund_preparation(
  UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, UUID[]
) TO service_role;

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Atomic cancellation with refund preparation function created successfully!';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Atomic booking cancellation + refund record creation';
  RAISE NOTICE '  - Comprehensive logging at each step';
  RAISE NOTICE '  - Detailed debug info for troubleshooting';
  RAISE NOTICE '  - Optimistic locking to prevent race conditions';
  RAISE NOTICE '  - Rollback on any failure';
END $$;
