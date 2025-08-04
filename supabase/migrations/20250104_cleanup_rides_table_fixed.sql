-- Cleanup rides table - Remove unwanted fields (FIXED VERSION)
-- Remove total_seats and car_year fields as requested

-- First, let's see what we have
DO $$
BEGIN
  RAISE NOTICE 'Current rides table schema:';
  RAISE NOTICE 'total_seats: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'total_seats');
  RAISE NOTICE 'car_year: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'car_year');
  RAISE NOTICE 'seats_available: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'seats_available');
END $$;

-- Remove the unwanted fields
ALTER TABLE public.rides 
DROP COLUMN IF EXISTS total_seats,
DROP COLUMN IF EXISTS car_year;

-- Verify the cleanup
DO $$
BEGIN
  RAISE NOTICE 'After cleanup, rides table has these fields:';
  RAISE NOTICE 'id: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'id');
  RAISE NOTICE 'driver_id: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'driver_id');
  RAISE NOTICE 'from_city: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'from_city');
  RAISE NOTICE 'to_city: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'to_city');
  RAISE NOTICE 'departure_time: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'departure_time');
  RAISE NOTICE 'price: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'price');
  RAISE NOTICE 'seats_available: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'seats_available');
  RAISE NOTICE 'car_model: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'car_model');
  RAISE NOTICE 'car_color: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'car_color');
  RAISE NOTICE 'created_at: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'created_at');
  RAISE NOTICE 'updated_at: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'updated_at');
END $$; 