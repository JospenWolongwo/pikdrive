-- Add vehicle images to current drivers who have rides
-- First, let's see what drivers we have
SELECT DISTINCT driver_id FROM rides;

-- Add vehicle images to the first driver (a106dcf9-1faf-4c5a-8971-45a707b395c5)
INSERT INTO public.driver_documents (
  id,
  driver_id,
  national_id_number,
  license_number,
  registration_number,
  insurance_number,
  technical_inspection_number,
  national_id_file,
  license_file,
  registration_file,
  insurance_file,
  technical_inspection_file,
  vehicle_images,
  status,
  created_at
) VALUES (
  gen_random_uuid(),
  'a106dcf9-1faf-4c5a-8971-45a707b395c5', -- Current driver ID
  'ID12345678',
  'DL98765432',
  'REG123456',
  'INS987654',
  'TECH123456',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/national_id/driver1_id.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/license/driver1_license.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/registration/driver1_reg.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/insurance/driver1_insurance.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/inspection/driver1_inspection.png',
  ARRAY[
    'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/vehicle_images/driver1_car_front.png',
    'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/vehicle_images/driver1_car_side.png'
  ],
  'pending',
  NOW()
)
ON CONFLICT (driver_id) DO UPDATE SET
  vehicle_images = EXCLUDED.vehicle_images,
  updated_at = NOW();

-- Add vehicle images to the second driver (8821b7c8-53b9-4952-8b38-bcdcc1c27046)
INSERT INTO public.driver_documents (
  id,
  driver_id,
  national_id_number,
  license_number,
  registration_number,
  insurance_number,
  technical_inspection_number,
  national_id_file,
  license_file,
  registration_file,
  insurance_file,
  technical_inspection_file,
  vehicle_images,
  status,
  created_at
) VALUES (
  gen_random_uuid(),
  '8821b7c8-53b9-4952-8b38-bcdcc1c27046', -- Current driver ID
  'ID87654321',
  'DL12345678',
  'REG654321',
  'INS123456',
  'TECH654321',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/national_id/driver2_id.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/license/driver2_license.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/registration/driver2_reg.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/insurance/driver2_insurance.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/inspection/driver2_inspection.png',
  ARRAY[
    'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/vehicle_images/driver2_car_front.png',
    'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/vehicle_images/driver2_car_side.png'
  ],
  'pending',
  NOW()
)
ON CONFLICT (driver_id) DO UPDATE SET
  vehicle_images = EXCLUDED.vehicle_images,
  updated_at = NOW();

-- Verify the vehicle images were added
SELECT driver_id, vehicle_images FROM driver_documents 
WHERE driver_id IN ('a106dcf9-1faf-4c5a-8971-45a707b395c5', '8821b7c8-53b9-4952-8b38-bcdcc1c27046'); 