-- Fix messages_sender_id_fkey to reference auth.users instead of users
-- The constraint was incorrectly created pointing to a 'users' table
-- but should reference auth.users(id) since user.id comes from supabase.auth.getUser()
DO $$
BEGIN
  -- Drop the existing constraint if it exists (regardless of what it references)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_sender_id_fkey' 
    AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE "public"."messages"
    DROP CONSTRAINT "messages_sender_id_fkey";
  END IF;
  
  -- Recreate it to point to the correct table (auth.users)
  ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_sender_id_fkey" 
  FOREIGN KEY ("sender_id") 
  REFERENCES "auth"."users"("id") 
  ON DELETE CASCADE;
END $$;

