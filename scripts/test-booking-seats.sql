-- Test script to check the current state of rides and bookings
-- This helps verify the seats_available issue

-- Check the specific ride mentioned in the user query
SELECT 
  r.id,
  r.from_city,
  r.to_city,
  r.seats_available,
  r.created_at,
  COUNT(b.id) as total_bookings,
  SUM(CASE WHEN b.status NOT IN ('cancelled', 'rejected') THEN b.seats ELSE 0 END) as active_booked_seats,
  r.seats_available + SUM(CASE WHEN b.status NOT IN ('cancelled', 'rejected') THEN b.seats ELSE 0 END) as calculated_total_seats
FROM rides r
LEFT JOIN bookings b ON r.id = b.ride_id
WHERE r.id = '4dc9e62d-b6d5-4f3d-856d-9812fbb3a777'
GROUP BY r.id, r.from_city, r.to_city, r.seats_available, r.created_at;

-- Check all rides for this driver to see the pattern
SELECT 
  r.id,
  r.from_city,
  r.to_city,
  r.seats_available,
  COUNT(b.id) as total_bookings,
  SUM(CASE WHEN b.status NOT IN ('cancelled', 'rejected') THEN b.seats ELSE 0 END) as active_booked_seats,
  r.seats_available + SUM(CASE WHEN b.status NOT IN ('cancelled', 'rejected') THEN b.seats ELSE 0 END) as calculated_total_seats
FROM rides r
LEFT JOIN bookings b ON r.id = b.ride_id
WHERE r.driver_id = '8821b7c8-53b9-4952-8b38-bcdcc1c27046'
GROUP BY r.id, r.from_city, r.to_city, r.seats_available
ORDER BY r.created_at DESC;

-- Check all bookings for the specific ride
SELECT 
  b.id,
  b.seats,
  b.status,
  b.payment_status,
  b.created_at,
  p.full_name as passenger_name
FROM bookings b
LEFT JOIN profiles p ON b.user_id = p.id
WHERE b.ride_id = '4dc9e62d-b6d5-4f3d-856d-9812fbb3a777'
ORDER BY b.created_at;
