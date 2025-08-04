-- Create realistic sample rides for Leaticia and Jospen
-- Using actual Cameroonian cities and realistic prices

-- First, let's get the city data
DO $$
BEGIN
  RAISE NOTICE 'Creating sample rides for Leaticia and Jospen...';
END $$;

-- Sample rides for Leaticia (from Bangangté)
INSERT INTO public.rides (
  driver_id,
  from_city,
  to_city,
  departure_time,
  price,
  seats_available,
  car_model,
  car_color,
  created_at,
  updated_at
) VALUES 
-- Leaticia's rides (from Bangangté)
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Douala', '2025-01-15 08:00:00+00', 3500, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Yaoundé', '2025-01-16 07:30:00+00', 2800, 3, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Bafoussam', '2025-01-17 09:00:00+00', 1200, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Kribi', '2025-01-18 06:00:00+00', 4200, 2, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Bamenda', '2025-01-19 08:30:00+00', 1800, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Ebolowa', '2025-01-20 07:00:00+00', 2500, 3, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Bertoua', '2025-01-21 08:00:00+00', 3200, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Garoua', '2025-01-22 06:30:00+00', 5500, 2, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Maroua', '2025-01-23 07:00:00+00', 6200, 3, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Ngaoundéré', '2025-01-24 08:00:00+00', 4800, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),

-- Jospen's rides (from Douala)
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Yaoundé', '2025-01-15 09:00:00+00', 2500, 4, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Bafoussam', '2025-01-16 08:30:00+00', 2000, 3, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Kribi', '2025-01-17 07:00:00+00', 1800, 4, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Bamenda', '2025-01-18 08:00:00+00', 2800, 2, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Ebolowa', '2025-01-19 09:30:00+00', 2200, 4, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Bertoua', '2025-01-20 07:30:00+00', 3000, 3, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Garoua', '2025-01-21 08:00:00+00', 4500, 2, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Maroua', '2025-01-22 06:00:00+00', 5200, 4, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Ngaoundéré', '2025-01-23 09:00:00+00', 3800, 3, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Bangangté', '2025-01-24 08:30:00+00', 1500, 4, 'Honda Civic', 'Noir', NOW(), NOW());

-- Verify the rides were created
DO $$
DECLARE
  leaticia_rides INTEGER;
  jospen_rides INTEGER;
BEGIN
  SELECT COUNT(*) INTO leaticia_rides FROM public.rides WHERE driver_id = 'a106dcf9-1faf-4c5a-8971-45a707b395c5';
  SELECT COUNT(*) INTO jospen_rides FROM public.rides WHERE driver_id = '8821b7c8-53b9-4952-8b38-bcdcc1c27046';
  
  RAISE NOTICE 'Sample rides created:';
  RAISE NOTICE 'Leaticia rides: %', leaticia_rides;
  RAISE NOTICE 'Jospen rides: %', jospen_rides;
  RAISE NOTICE 'Total rides: %', leaticia_rides + jospen_rides;
END $$; 