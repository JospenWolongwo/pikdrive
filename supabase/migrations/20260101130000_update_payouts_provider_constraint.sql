-- Update payouts_provider_check constraint to include 'pawapay'
-- This allows payouts to be created with provider='pawapay' when using pawaPay aggregator

-- Drop the existing constraint
ALTER TABLE "public"."payouts" 
DROP CONSTRAINT IF EXISTS "payouts_provider_check";

-- Add the updated constraint that includes 'pawapay'
ALTER TABLE "public"."payouts"
ADD CONSTRAINT "payouts_provider_check" 
CHECK (("provider")::"text" = ANY ((ARRAY['mtn'::character varying, 'orange'::character varying, 'pawapay'::character varying])::"text"[]));

