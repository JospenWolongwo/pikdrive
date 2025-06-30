-- Migration to add recto/verso document support to driver_documents table
-- Date: 2025-06-29

-- Update driver_documents table to support recto/verso document file uploads

-- National ID (CNI)
ALTER TABLE public.driver_documents RENAME COLUMN national_id_file TO national_id_file_recto;
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS national_id_file_verso TEXT;

-- Driver License (Permis de Conduire)
ALTER TABLE public.driver_documents RENAME COLUMN license_file TO license_file_recto;
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS license_file_verso TEXT;

-- Vehicle Registration (Carte Grise)
ALTER TABLE public.driver_documents RENAME COLUMN registration_file TO registration_file_recto;
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS registration_file_verso TEXT;

-- Insurance Certificate (Certificat d'Assurance)
ALTER TABLE public.driver_documents RENAME COLUMN insurance_file TO insurance_file_recto;
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS insurance_file_verso TEXT;

-- Technical inspection document remains a single file
-- No change needed for technical_inspection_file

-- Comment for documentation
COMMENT ON TABLE public.driver_documents IS 'Contains driver document information including recto/verso (front/back) images for official documents';

-- Add comments on columns for better documentation
COMMENT ON COLUMN public.driver_documents.national_id_file_recto IS 'URL to front/recto of national ID';
COMMENT ON COLUMN public.driver_documents.national_id_file_verso IS 'URL to back/verso of national ID';
COMMENT ON COLUMN public.driver_documents.license_file_recto IS 'URL to front/recto of driver license';
COMMENT ON COLUMN public.driver_documents.license_file_verso IS 'URL to back/verso of driver license';
COMMENT ON COLUMN public.driver_documents.registration_file_recto IS 'URL to front/recto of vehicle registration';
COMMENT ON COLUMN public.driver_documents.registration_file_verso IS 'URL to back/verso of vehicle registration';
COMMENT ON COLUMN public.driver_documents.insurance_file_recto IS 'URL to front/recto of insurance certificate';
COMMENT ON COLUMN public.driver_documents.insurance_file_verso IS 'URL to back/verso of insurance certificate';
