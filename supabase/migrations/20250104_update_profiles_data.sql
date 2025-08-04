-- Update profiles with correct data for Leaticia and Jospen
-- Also update driver status for Leaticia to approved

-- Update Leaticia's profile
UPDATE public.profiles 
SET 
  full_name = 'Leaticia',
  email = 'tchomnouleati@gmail.com',
  city = 'Bangangté',
  is_driver = true,
  driver_status = 'approved',
  role = 'driver',
  driver_application_status = 'approved',
  driver_application_date = '2025-08-04 20:58:43.627+00',
  is_driver_applicant = true,
  updated_at = NOW()
WHERE id = 'a106dcf9-1faf-4c5a-8971-45a707b395c5';

-- Update Jospen's profile
UPDATE public.profiles 
SET 
  full_name = 'Jospen',
  email = 'user@example.com',
  city = 'Douala',
  is_driver = true,
  driver_status = 'approved',
  role = 'admin',
  driver_application_status = 'approved',
  is_driver_applicant = false,
  updated_at = NOW()
WHERE id = '8821b7c8-53b9-4952-8b38-bcdcc1c27046';

-- Verify the updates
DO $$
BEGIN
  RAISE NOTICE 'Updated profiles:';
  RAISE NOTICE 'Leaticia - driver_status: %', (SELECT driver_status FROM public.profiles WHERE id = 'a106dcf9-1faf-4c5a-8971-45a707b395c5');
  RAISE NOTICE 'Leaticia - role: %', (SELECT role FROM public.profiles WHERE id = 'a106dcf9-1faf-4c5a-8971-45a707b395c5');
  RAISE NOTICE 'Jospen - driver_status: %', (SELECT driver_status FROM public.profiles WHERE id = '8821b7c8-53b9-4952-8b38-bcdcc1c27046');
  RAISE NOTICE 'Jospen - role: %', (SELECT role FROM public.profiles WHERE id = '8821b7c8-53b9-4952-8b38-bcdcc1c27046');
END $$; 