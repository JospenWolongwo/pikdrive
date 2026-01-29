-- WhatsApp webhook event logs (messages, status updates, errors from Meta)
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('message', 'status', 'error')),
  message_id TEXT,
  from_number TEXT,
  "timestamp" TEXT,
  type TEXT,
  status TEXT,
  metadata JSONB,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_webhook_logs IS 'Webhook events from WhatsApp Business API (incoming messages, status, errors)';

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_kind ON public.whatsapp_webhook_logs(kind);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_message_id ON public.whatsapp_webhook_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_created_at ON public.whatsapp_webhook_logs(created_at);
