-- Add missing driver document for Peter (4a638248-d48f-4839-9315-6d5d8b4fa0af)
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
  '4a638248-d48f-4839-9315-6d5d8b4fa0af', -- Peter's ID
  'ID12345678',
  'DL98765432',
  'REG123456',
  'INS987654',
  'TECH123456',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/national_id/peter_id.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/license/peter_license.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/registration/peter_reg.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/insurance/peter_insurance.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/inspection/peter_inspection.png',
  ARRAY[
    'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/vehicle_images/peter_car_front.png',
    'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/vehicle_images/peter_car_side.png'
  ],
  'pending',
  NOW()
);

-- Add missing driver document for the unnamed driver (c7b75c56-aa77-41c2-b1ce-4711c24d0548) 
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
  'c7b75c56-aa77-41c2-b1ce-4711c24d0548',
  'ID87654321',
  'DL12345678',
  'REG654321',
  'INS123456',
  'TECH654321',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/national_id/unnamed_id.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/license/unnamed_license.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/registration/unnamed_reg.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/insurance/unnamed_insurance.png',
  'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/inspection/unnamed_inspection.png',
  ARRAY[
    'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/vehicle_images/unnamed_car_front.png',
    'https://lvtwvyxolrjbupltmqrl.supabase.co/storage/v1/object/public/driver_documents/vehicle_images/unnamed_car_side.png'
  ],
  'pending',
  NOW()
);
