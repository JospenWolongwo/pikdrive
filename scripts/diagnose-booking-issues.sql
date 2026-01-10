-- ============================================================================
-- DIAGNOSTIC SCRIPT: Booking and Seat Calculation Issues
-- ============================================================================
-- Purpose: This script helps identify the root causes of:
--   1. Duplicate bookings being created
--   2. Seat counts getting stuck (especially at 1 seat)
--   3. Seats not being properly decremented/incremented
--
-- How to use: Run each section one at a time in Supabase SQL Editor
-- Review the results before proceeding to understand what's happening
-- ============================================================================

-- ============================================================================
-- SECTION 1: Check for Duplicate Bookings
-- ============================================================================
-- Why we check this: If users can book the same ride multiple times,
-- it means either:
--   - The unique constraint is missing or not working
--   - The application logic isn't detecting existing bookings correctly
-- ============================================================================
SELECT 
  ride_id,
  user_id,
  COUNT(*) as booking_count,
  STRING_AGG(id::text, ', ') as booking_ids,
  STRING_AGG(status::text, ', ') as statuses,  -- Cast enum to text
  STRING_AGG(payment_status::text, ', ') as payment_statuses,  -- Cast enum to text
  SUM(seats) as total_seats_booked,
  STRING_AGG(created_at::text, ', ') as created_dates
FROM bookings
GROUP BY ride_id, user_id
HAVING COUNT(*) > 1  -- Only show cases where same user has multiple bookings for same ride
ORDER BY booking_count DESC;

-- ============================================================================
-- SECTION 2: Check for Seat Count Inconsistencies
-- ============================================================================
-- Why we check this: Since the rides table doesn't have total_seats column,
-- we check for logical inconsistencies:
--   1. Negative seats_available (should never happen)
--   2. Many active bookings but seats_available still high (seats not decremented)
--   3. seats_available = 1 but multiple bookings exist (the reported problem!)
-- ============================================================================
SELECT 
  r.id as ride_id,
  r.from_city,
  r.to_city,
  r.seats_available as current_available,  -- What the system thinks is available
  COALESCE(SUM(b.seats), 0) as actual_booked_seats,  -- Total seats in active bookings
  COUNT(b.id) as active_booking_count,  -- How many active bookings
  -- Calculate potential issues:
  CASE 
    WHEN r.seats_available < 0 THEN 'NEGATIVE_SEATS'
    WHEN r.seats_available = 1 AND COUNT(b.id) > 1 THEN 'STUCK_AT_ONE'
    WHEN r.seats_available > 0 AND COUNT(b.id) > 0 AND r.seats_available > SUM(b.seats) THEN 'TOO_MANY_AVAILABLE'
    ELSE 'CHECK_MANUALLY'
  END as issue_type,
  STRING_AGG(
    'B' || b.id::text || ':' || b.seats::text || ':' || b.status::text, 
    ', '
  ) as booking_details
FROM rides r
LEFT JOIN bookings b 
  ON r.id = b.ride_id 
  AND b.status NOT IN ('cancelled', 'completed')  -- Only count active bookings
  AND b.payment_status != 'failed'  -- Don't count failed payments
GROUP BY r.id, r.from_city, r.to_city, r.seats_available
HAVING 
  -- Show rides with potential issues:
  r.seats_available < 0  -- Negative seats (impossible!)
  OR (r.seats_available = 1 AND COUNT(b.id) > 1)  -- Stuck at 1 with multiple bookings (reported issue!)
  OR (COUNT(b.id) > 0 AND r.seats_available > SUM(b.seats) + 10)  -- Way more available than should be
ORDER BY 
  CASE 
    WHEN r.seats_available < 0 THEN 1  -- Negative seats first (worst)
    WHEN r.seats_available = 1 AND COUNT(b.id) > 1 THEN 2  -- Stuck at 1 second (reported issue)
    ELSE 3
  END,
  active_booking_count DESC  -- Then by number of bookings
LIMIT 50;

-- ============================================================================
-- SECTION 2B: Deep Dive - Check ALL Bookings for Rides with seats_available = 1
-- ============================================================================
-- Why we check this: Section 2 found nothing, but user reported seats stuck at 1.
-- Let's look at ALL bookings (including cancelled/completed) for rides with 1 seat.
-- This might reveal if cancelled bookings are causing issues.
-- ============================================================================
SELECT 
  r.id as ride_id,
  r.from_city,
  r.to_city,
  r.seats_available,
  r.created_at as ride_created,
  b.id as booking_id,
  b.user_id,
  b.seats as seats_booked,
  b.status as booking_status,
  b.payment_status,
  b.created_at as booking_created,
  b.updated_at as booking_updated,
  -- Count active bookings for this ride
  (SELECT COUNT(*) 
   FROM bookings b2 
   WHERE b2.ride_id = r.id 
   AND b2.status NOT IN ('cancelled', 'completed')
   AND b2.payment_status != 'failed'
  ) as active_bookings_count,
  -- Total seats in active bookings
  (SELECT COALESCE(SUM(b2.seats), 0)
   FROM bookings b2 
   WHERE b2.ride_id = r.id 
   AND b2.status NOT IN ('cancelled', 'completed')
   AND b2.payment_status != 'failed'
  ) as active_seats_total
FROM rides r
LEFT JOIN bookings b ON r.id = b.ride_id
WHERE r.seats_available = 1  -- Focus on the reported issue
ORDER BY r.created_at DESC, b.created_at DESC
LIMIT 100;

-- ============================================================================
-- SECTION 3: Check Rides with Seats Stuck at 1
-- ============================================================================
-- Why we check this: User reported that after booking, seats_available 
-- stays at 1 even when multiple bookings are made. This finds those cases.
-- ============================================================================
SELECT 
  r.id as ride_id,
  r.from_city,
  r.to_city,
  r.seats_available,  -- Should be 1 based on user's report of stuck seats
  COUNT(b.id) as active_booking_count,  -- How many active bookings exist
  COALESCE(SUM(b.seats), 0) as total_active_seats,  -- Total seats booked
  STRING_AGG(
    'Booking:' || b.id::text || ' | Seats:' || b.seats::text || ' | Status:' || b.status::text || ' | Payment:' || b.payment_status::text, 
    ' || '
  ) as booking_details
FROM rides r
LEFT JOIN bookings b 
  ON r.id = b.ride_id 
  AND b.status NOT IN ('cancelled', 'completed')
  AND b.payment_status != 'failed'
WHERE r.seats_available = 1  -- Focus on the specific problem case
GROUP BY r.id, r.from_city, r.to_city, r.seats_available
ORDER BY active_booking_count DESC, r.created_at DESC;

-- ============================================================================
-- SECTION 4: Check Recent Duplicate Bookings by Same User
-- ============================================================================
-- Why we check this: This shows us if the same user is booking the same ride
-- multiple times, which should be prevented by the unique constraint
-- ============================================================================
SELECT 
  b1.id as first_booking_id,
  b1.ride_id,
  b1.user_id,
  b1.seats as first_booking_seats,
  b1.status as first_status,
  b1.payment_status as first_payment_status,
  b1.created_at as first_created,
  b2.id as second_booking_id,
  b2.seats as second_booking_seats,
  b2.status as second_status,
  b2.payment_status as second_payment_status,
  b2.created_at as second_created,
  b2.created_at - b1.created_at as time_between_bookings,
  -- Calculate if seats were decremented for both
  (SELECT seats_available FROM rides WHERE id = b1.ride_id) as current_ride_seats
FROM bookings b1
INNER JOIN bookings b2 
  ON b1.ride_id = b2.ride_id 
  AND b1.user_id = b2.user_id
  AND b1.id < b2.id  -- Only compare different bookings
WHERE b1.status NOT IN ('cancelled', 'completed')
  AND b2.status NOT IN ('cancelled', 'completed')
ORDER BY b2.created_at DESC  -- Most recent duplicates first
LIMIT 20;

-- ============================================================================
-- SECTION 5: Verify Unique Constraint Exists
-- ============================================================================
-- Why we check this: If the unique constraint is missing, that explains
-- why duplicate bookings can be created. This should prevent duplicates!
-- ============================================================================
SELECT 
  conname as constraint_name,
  CASE contype 
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'p' THEN 'PRIMARY KEY'
    ELSE contype::text
  END as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass
  AND contype IN ('u', 'p')  -- unique or primary key constraints
ORDER BY conname;

-- Expected result: Should show a constraint like:
-- unique_user_ride_booking UNIQUE (user_id, ride_id)
-- If this is missing, that's a major problem!

-- ============================================================================
-- SECTION 6: Check if Seat Update Trigger Function Exists
-- ============================================================================
-- Why we check this: The trigger function should automatically update
-- seats_available when bookings are created/updated/deleted. If it's
-- missing or wrong, seats won't update correctly.
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  routine_schema,
  -- Show a preview of the function (first 500 chars)
  LEFT(routine_definition, 500) as function_preview
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_seats_on_booking_change';

-- Expected: Should return one row with the function definition

-- ============================================================================
-- SECTION 7: Check if Triggers are Enabled and Working
-- ============================================================================
-- Why we check this: Even if the function exists, the triggers need to
-- be enabled for them to fire. This shows us what triggers exist.
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation as event_type,  -- INSERT, UPDATE, DELETE
  event_object_table as table_name,
  action_timing as when_fires,  -- BEFORE, AFTER
  action_statement as what_executes
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'bookings'
ORDER BY trigger_name;

-- Expected: Should show triggers like:
-- update_seats_on_booking_insert (AFTER INSERT)
-- update_seats_on_booking_update (AFTER UPDATE)  
-- update_seats_on_booking_delete (AFTER DELETE)

-- ============================================================================
-- SECTION 8: Check the reserve_ride_seats Function
-- ============================================================================
-- Why we check this: This is the main function that handles booking creation/update.
-- If it has bugs, that's where the problem is.
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  routine_schema,
  LEFT(routine_definition, 1000) as function_preview
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'reserve_ride_seats';

-- Expected: Should show the function we looked at earlier
-- This is the atomic function that should prevent race conditions

-- ============================================================================
-- SECTION 9: Sample Data - Recent Bookings with Their Rides
-- ============================================================================
-- Why we check this: This gives us real examples to understand the pattern.
-- Look for cases where seats_available doesn't match expected value.
-- ============================================================================
SELECT 
  b.id as booking_id,
  b.ride_id,
  b.user_id,
  b.seats as seats_booked,
  b.status as booking_status,
  b.payment_status,
  b.created_at as booking_created,
  b.updated_at as booking_updated,
  r.seats_available,
  -- Calculate total active seats for this ride
  (SELECT COALESCE(SUM(b2.seats), 0)
   FROM bookings b2 
   WHERE b2.ride_id = b.ride_id 
   AND b2.status NOT IN ('cancelled', 'completed')
   AND b2.payment_status != 'failed'
  ) as total_active_seats_for_ride,
  -- Count how many active bookings exist for this ride
  (SELECT COUNT(*)
   FROM bookings b2 
   WHERE b2.ride_id = b.ride_id 
   AND b2.status NOT IN ('cancelled', 'completed')
   AND b2.payment_status != 'failed'
  ) as active_booking_count
FROM bookings b
JOIN rides r ON b.ride_id = r.id
WHERE b.created_at > NOW() - INTERVAL '7 days'  -- Last 7 days
ORDER BY b.created_at DESC
LIMIT 50;

-- ============================================================================
-- SECTION 10: Check Payments for Specific Ride/Booking
-- ============================================================================
-- Why we check this: To understand if multiple payments exist for same booking,
-- which would indicate rebooking/updates happening. This helps us see if the
-- UPDATE mode in reserve_ride_seats is being called correctly.
-- ============================================================================
-- Replace the ride_id and booking_id with actual values from Section 2B results
-- Example: Check payments for the ride we found
SELECT 
  p.id as payment_id,
  p.booking_id,
  p.amount,
  p.status as payment_status,
  p.provider,
  p.created_at as payment_created,
  p.updated_at as payment_updated,
  p.transaction_id,
  b.ride_id,
  b.user_id,
  b.seats as booking_seats,
  b.status as booking_status,
  b.payment_status as booking_payment_status,
  b.created_at as booking_created,
  b.updated_at as booking_updated,
  r.seats_available
FROM payments p
JOIN bookings b ON p.booking_id = b.id
JOIN rides r ON b.ride_id = r.id
WHERE b.ride_id = 'acb9811c-0970-40b2-8743-943b68444846'  -- The ride_id from Section 2B
ORDER BY p.created_at DESC;

-- ============================================================================
-- SECTION 10B: Check ALL Payments for Rides with seats_available = 1
-- ============================================================================
-- This shows us if there are multiple payments being made for bookings on
-- rides with only 1 seat available. This would indicate the rebooking issue.
-- ============================================================================
SELECT 
  r.id as ride_id,
  r.from_city,
  r.to_city,
  r.seats_available,
  b.id as booking_id,
  b.user_id,
  b.seats as booking_seats,
  b.status as booking_status,
  b.payment_status as booking_payment_status,
  COUNT(p.id) as payment_count,  -- How many payments for this booking
  STRING_AGG(
    'Payment:' || p.id::text || ' | Amount:' || p.amount::text || ' | Status:' || p.status::text || ' | Date:' || p.created_at::text,
    ' || '
  ) as payment_details,
  SUM(p.amount) as total_paid,
  MIN(p.created_at) as first_payment_date,
  MAX(p.created_at) as last_payment_date
FROM rides r
JOIN bookings b ON r.id = b.ride_id
LEFT JOIN payments p ON b.id = p.booking_id
WHERE r.seats_available = 1
  AND b.status NOT IN ('cancelled', 'completed')
GROUP BY r.id, r.from_city, r.to_city, r.seats_available, b.id, b.user_id, b.seats, b.status, b.payment_status
ORDER BY payment_count DESC, last_payment_date DESC;

-- ============================================================================
-- ANALYSIS NOTES:
-- ============================================================================
-- After running these queries, look for:
-- 
-- 1. Section 1: If you see rows, duplicate bookings exist (BAD!)
-- 2. Section 2: Large discrepancy values mean seats are counted wrong (BAD!)
-- 3. Section 3: Multiple active bookings but seats_available = 1 (BAD!)
-- 4. Section 4: Same user, same ride, multiple bookings (BAD!)
-- 5. Section 5: Missing unique constraint = major problem (VERY BAD!)
-- 6. Section 6-7: Missing trigger = seats won't update automatically (BAD!)
-- 7. Section 8: Function exists but might have bugs (need to review code)
-- 8. Section 9: Real examples showing the problem pattern
-- ============================================================================
