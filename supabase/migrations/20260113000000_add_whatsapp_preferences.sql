-- Add WhatsApp notification preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.profiles.whatsapp_notifications_enabled IS 'User preference for receiving WhatsApp notifications. Defaults to true for opt-in by default.';

-- Add index for querying users with WhatsApp enabled
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_enabled ON public.profiles(whatsapp_notifications_enabled) WHERE whatsapp_notifications_enabled = true;
