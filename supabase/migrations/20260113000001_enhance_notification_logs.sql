-- Enhance notification_logs table with WhatsApp-specific fields
ALTER TABLE public.notification_logs
ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_status TEXT,
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'onesignal' CHECK (channel IN ('onesignal', 'whatsapp', 'both'));

COMMENT ON COLUMN public.notification_logs.whatsapp_message_id IS 'WhatsApp message ID returned from Meta API';
COMMENT ON COLUMN public.notification_logs.whatsapp_status IS 'WhatsApp message delivery status (sent, delivered, read, failed)';
COMMENT ON COLUMN public.notification_logs.channel IS 'Notification channel used: onesignal (push), whatsapp (message), or both';

-- Add index for querying WhatsApp notifications
CREATE INDEX IF NOT EXISTS idx_notification_logs_whatsapp_message_id ON public.notification_logs(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON public.notification_logs(channel);
