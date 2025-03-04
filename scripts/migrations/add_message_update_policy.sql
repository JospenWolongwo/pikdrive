-- Add policy for updating messages
DO $$ 
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Users can update messages they sent or received" ON public.messages;

  -- Create new policy
  CREATE POLICY "Users can update messages they sent or received" 
    ON public.messages 
    FOR UPDATE 
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Error creating message update policy: %', SQLERRM;
END $$;
