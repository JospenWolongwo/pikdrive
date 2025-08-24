-- Corrected migration to fix existing rides with incorrect seats_available values
-- This properly calculates seats_available as original_seats minus booked_seats

-- First, let's see what we're working with
SELECT 
  'Current state' as info,
  COUNT(*) as total_rides,
  AVG(seats_available) as avg_seats_available
FROM rides;

-- Create a temporary table to store the correct calculations
CREATE TEMP TABLE seat_calculations AS
SELECT 
  r.id,
  r.seats_available as current_seats,
  COALESCE(SUM(b.seats), 0) as booked_seats,
  r.seats_available + COALESCE(SUM(b.seats), 0) as original_total_seats,
  GREATEST(0, r.seats_available - COALESCE(SUM(b.seats), 0)) as correct_available_seats
FROM rides r
LEFT JOIN bookings b ON r.id = b.ride_id AND b.status NOT IN ('cancelled', 'rejected')
GROUP BY r.id, r.seats_available;

-- Show what we calculated
SELECT 
  'Calculations' as info,
  COUNT(*) as total_rides,
  AVG(booked_seats) as avg_booked_seats,
  AVG(correct_available_seats) as avg_correct_seats
FROM seat_calculations;

-- Update the rides table with the correct seats_available
UPDATE rides 
SET seats_available = sc.correct_available_seats,
    updated_at = NOW()
FROM seat_calculations sc
WHERE rides.id = sc.id;

-- Show the results after the fix
SELECT 
  'After fix' as info,
  COUNT(*) as total_rides,
  AVG(seats_available) as avg_seats_available
FROM rides;

-- Show specific examples of what was fixed
SELECT 
  'Fixed rides' as info,
  r.id,
  r.from_city,
  r.to_city,
  r.seats_available as new_seats_available,
  COUNT(b.id) as total_bookings,
  SUM(CASE WHEN b.status NOT IN ('cancelled', 'rejected') THEN b.seats ELSE 0 END) as active_booked_seats
FROM rides r
LEFT JOIN bookings b ON r.id = b.ride_id
WHERE EXISTS (
  SELECT 1 FROM bookings b2 
  WHERE b2.ride_id = r.id 
  AND b2.status NOT IN ('cancelled', 'rejected')
)
GROUP BY r.id, r.from_city, r.to_city, r.seats_available
ORDER BY active_booked_seats DESC
LIMIT 10;

-- Clean up
DROP TABLE seat_calculations;
