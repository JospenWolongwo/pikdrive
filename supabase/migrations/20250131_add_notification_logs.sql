-- Create notification_logs table for analytics
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  
  -- OneSignal tracking
  onesignal_id TEXT,
  recipients INTEGER DEFAULT 0,
  
  -- Additional data
  data JSONB,
  
  -- Status tracking
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'clicked', 'failed')),
  delivered_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX idx_notification_logs_notification_type ON public.notification_logs(notification_type);
CREATE INDEX idx_notification_logs_status ON public.notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON public.notification_logs(created_at DESC);
CREATE INDEX idx_notification_logs_onesignal_id ON public.notification_logs(onesignal_id);

-- RLS Policies
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification logs
CREATE POLICY notification_logs_select_own ON public.notification_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert logs
CREATE POLICY notification_logs_insert_service ON public.notification_logs
  FOR INSERT
  WITH CHECK (true);

-- Service role can update logs
CREATE POLICY notification_logs_update_service ON public.notification_logs
  FOR UPDATE
  USING (true);

-- Comments
COMMENT ON TABLE public.notification_logs IS 'Tracks all notifications sent via OneSignal for analytics';
COMMENT ON COLUMN public.notification_logs.onesignal_id IS 'OneSignal notification ID for tracking';
COMMENT ON COLUMN public.notification_logs.recipients IS 'Number of devices that received the notification';
COMMENT ON COLUMN public.notification_logs.notification_type IS 'Type: booking_created, payment_completed, new_message, etc.';
