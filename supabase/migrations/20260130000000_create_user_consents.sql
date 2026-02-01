-- Create user_consents table to track when users accept terms and conditions
-- This table stores legal consent records for compliance and audit purposes

CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms_and_privacy', 'driver_terms')),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  terms_version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_consent_type ON public.user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consents_accepted_at ON public.user_consents(accepted_at);

-- Enable Row Level Security
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own consent records
CREATE POLICY "Users can view own consents"
  ON public.user_consents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own consent records
CREATE POLICY "Users can insert own consents"
  ON public.user_consents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can do anything (for admin/audit purposes)
CREATE POLICY "Service role has full access"
  ON public.user_consents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE public.user_consents IS 'Stores user consent records for legal compliance. Tracks when users accept terms of service, privacy policy, and driver-specific terms.';
