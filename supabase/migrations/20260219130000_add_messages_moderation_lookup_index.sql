-- Optimize moderation context lookup for sender messages in a conversation
-- Query pattern:
--   WHERE conversation_id = ? AND sender_id = ?
--   ORDER BY created_at DESC
--   LIMIT 12
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sender_created_desc
ON public.messages USING btree (conversation_id, sender_id, created_at DESC);
