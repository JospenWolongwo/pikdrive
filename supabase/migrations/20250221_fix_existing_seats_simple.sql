-- Simple migration to fix existing rides with incorrect seats_available values
-- This directly updates seats_available based on actual bookings

-- First, let's see what we're working with
SELECT 
  'Current state' as info,
  COUNT(*) as total_rides,
  AVG(seats_available) as avg_seats_available
FROM rides;

-- Update seats_available for all rides based on their actual bookings
-- This assumes that seats_available should represent the actual available seats
-- and that we need to account for all non-cancelled/rejected bookings

UPDATE rides 
SET seats_available = (
  SELECT GREATEST(0, seats_available - COALESCE(SUM(seats), 0))
  FROM bookings 
  WHERE ride_id = rides.id 
  AND status NOT IN ('cancelled', 'rejected')
)
WHERE id IN (
  SELECT DISTINCT ride_id 
  FROM bookings 
  WHERE status NOT IN ('cancelled', 'rejected')
);

-- Show the results
SELECT 
  'After fix' as info,
  COUNT(*) as total_rides,
  AVG(seats_available) as avg_seats_available
FROM rides;

-- Show what changed for rides with bookings
SELECT 
  'Changes made' as info,
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
ORDER BY active_booked_seats DESC;

-- Show specific examples of what was fixed
SELECT 
  r.id,
  r.from_city,
  r.to_city,
  r.seats_available as current_seats,
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
