-- Clear rides table and create exactly 20 rides
-- This will give us a clean slate with the correct structure

-- Clear all related data in correct order (due to foreign key constraints)
DELETE FROM public.payment_receipts;
DELETE FROM public.payments;
DELETE FROM public.bookings;
DELETE FROM public.messages;
DELETE FROM public.rides;

-- Create 20 rides with future dates
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
-- Leaticia's rides (10 rides)
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Douala', NOW() + INTERVAL '1 day' + INTERVAL '8 hours', 3500, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Yaoundé', NOW() + INTERVAL '2 days' + INTERVAL '7 hours', 2800, 3, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Bafoussam', NOW() + INTERVAL '3 days' + INTERVAL '9 hours', 1200, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Kribi', NOW() + INTERVAL '4 days' + INTERVAL '6 hours', 4200, 2, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Bamenda', NOW() + INTERVAL '5 days' + INTERVAL '8 hours', 1800, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Ebolowa', NOW() + INTERVAL '6 days' + INTERVAL '7 hours', 2500, 3, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Bertoua', NOW() + INTERVAL '7 days' + INTERVAL '8 hours', 3200, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Garoua', NOW() + INTERVAL '8 days' + INTERVAL '6 hours', 5500, 2, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Maroua', NOW() + INTERVAL '9 days' + INTERVAL '7 hours', 6200, 3, 'Toyota Corolla', 'Blanc', NOW(), NOW()),
('a106dcf9-1faf-4c5a-8971-45a707b395c5', 'Bangangté', 'Ngaoundéré', NOW() + INTERVAL '10 days' + INTERVAL '8 hours', 4800, 4, 'Toyota Corolla', 'Blanc', NOW(), NOW()),

-- Jospen's rides (10 rides)
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Yaoundé', NOW() + INTERVAL '1 day' + INTERVAL '9 hours', 2500, 4, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Bafoussam', NOW() + INTERVAL '2 days' + INTERVAL '8 hours', 2000, 3, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Kribi', NOW() + INTERVAL '3 days' + INTERVAL '7 hours', 1800, 4, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Bamenda', NOW() + INTERVAL '4 days' + INTERVAL '8 hours', 2800, 2, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Ebolowa', NOW() + INTERVAL '5 days' + INTERVAL '9 hours', 2200, 4, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Bertoua', NOW() + INTERVAL '6 days' + INTERVAL '7 hours', 3000, 3, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Garoua', NOW() + INTERVAL '7 days' + INTERVAL '8 hours', 4500, 2, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Maroua', NOW() + INTERVAL '8 days' + INTERVAL '6 hours', 5200, 4, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Ngaoundéré', NOW() + INTERVAL '9 days' + INTERVAL '9 hours', 3800, 3, 'Honda Civic', 'Noir', NOW(), NOW()),
('8821b7c8-53b9-4952-8b38-bcdcc1c27046', 'Douala', 'Bangangté', NOW() + INTERVAL '10 days' + INTERVAL '8 hours', 1500, 4, 'Honda Civic', 'Noir', NOW(), NOW());

-- Verify the setup
SELECT 
  COUNT(*) as total_rides,
  COUNT(*) FILTER (WHERE departure_time > NOW()) as future_rides,
  COUNT(*) FILTER (WHERE departure_time <= NOW()) as past_rides
FROM public.rides; 