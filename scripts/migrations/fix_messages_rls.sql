-- Enable RLS on messages table and set up proper policies
BEGIN;

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages they sent or received" ON public.messages;

-- Create comprehensive policies for messages
CREATE POLICY "Users can view messages they sent or received" 
ON public.messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" 
ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update messages they sent or received" 
ON public.messages FOR UPDATE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

COMMIT;
