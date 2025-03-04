-- Add read column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- Add index for faster querying of unread messages
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read) WHERE read = FALSE;

-- Add index for faster querying of unread messages by receiver
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread 
ON messages(receiver_id, read) 
WHERE read = FALSE;

-- Update existing messages to be marked as read
UPDATE messages SET read = TRUE WHERE created_at < NOW();
