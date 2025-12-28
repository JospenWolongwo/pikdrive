-- Migration to create passenger_documents table
-- Date: 2025-01-01

CREATE TABLE IF NOT EXISTS public.passenger_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Required passenger information
  full_name TEXT NOT NULL,
  national_id_file_recto TEXT NOT NULL,
  national_id_file_verso TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_passenger_documents_user_id ON public.passenger_documents(user_id);

-- Enable RLS
ALTER TABLE public.passenger_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own documents
CREATE POLICY "passengers_select_own" ON public.passenger_documents
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "passengers_insert_own" ON public.passenger_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "passengers_update_own" ON public.passenger_documents
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all passenger documents
CREATE POLICY "admins_select_passengers" ON public.passenger_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Comments for documentation
COMMENT ON TABLE public.passenger_documents IS 'Contains passenger identification documents (name and ID card front/back)';
COMMENT ON COLUMN public.passenger_documents.national_id_file_recto IS 'URL to front/recto of national ID card';
COMMENT ON COLUMN public.passenger_documents.national_id_file_verso IS 'URL to back/verso of national ID card';

