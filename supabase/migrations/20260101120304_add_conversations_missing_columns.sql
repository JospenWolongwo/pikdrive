-- Add missing columns to conversations table
-- The conversations table in UAT is missing updated_at and last_message_at columns
-- that are required by the chat service
DO $$
BEGIN
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "public"."conversations"
    ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();
  END IF;

  -- Add last_message_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE "public"."conversations"
    ADD COLUMN "last_message_at" timestamp with time zone;
  END IF;
END $$;

