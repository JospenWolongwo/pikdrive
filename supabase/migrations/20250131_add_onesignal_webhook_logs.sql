-- Create OneSignal webhook logs table for analytics
CREATE TABLE IF NOT EXISTS onesignal_webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  notification_id TEXT,
  user_id TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE onesignal_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert webhook logs
CREATE POLICY "Service role can insert webhook logs" 
ON onesignal_webhook_logs 
FOR INSERT 
TO service_role 
USING (true);

-- Allow authenticated users to read their own logs
CREATE POLICY "Users can read own webhook logs" 
ON onesignal_webhook_logs 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid()::text);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_onesignal_webhook_logs_user_id 
ON onesignal_webhook_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_onesignal_webhook_logs_event_type 
ON onesignal_webhook_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_onesignal_webhook_logs_created_at 
ON onesignal_webhook_logs(created_at);
