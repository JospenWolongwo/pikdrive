-- Fix push_subscriptions table schema
-- Add missing columns for better subscription management
-- Based on actual table structure: UUID primary key, no sequence

-- Add last_used column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'push_subscriptions' 
        AND column_name = 'last_used'
    ) THEN
        ALTER TABLE push_subscriptions 
        ADD COLUMN last_used TIMESTAMP WITH TIME ZONE;
    END IF;
    
END $$;

-- Add deactivation_reason column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'push_subscriptions' 
        AND column_name = 'deactivation_reason'
    ) THEN
        ALTER TABLE push_subscriptions 
        ADD COLUMN deactivation_reason TEXT;
    END IF;
END $$;

-- Update existing records to have updated_at timestamp if it's NULL
UPDATE push_subscriptions 
SET updated_at = COALESCE(updated_at, created_at) 
WHERE updated_at IS NULL;

-- Create index on last_used for better performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_used 
ON push_subscriptions(last_used);

-- Create index on updated_at for cleanup operations
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_updated_at 
ON push_subscriptions(updated_at);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active 
ON push_subscriptions(is_active);

-- Create index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON push_subscriptions(user_id);

-- Grant necessary permissions (adjust based on your RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'push_subscriptions' 
ORDER BY ordinal_position;
