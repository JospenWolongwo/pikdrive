-- ============================================================================
-- Rollback: Remove the buggy migration before applying the fixed version
-- ============================================================================

-- Remove the migration record so it can be re-applied
DELETE FROM supabase_migrations.schema_migrations 
WHERE version = '20260111100000';

-- Note: The function created by the migration will be replaced by the fixed version
-- No need to drop it here as the new migration will recreate it

DO $$
BEGIN
  RAISE NOTICE '✅ Rolled back migration 20260111100000';
  RAISE NOTICE 'Now apply the fixed version: 20260111110000_bulletproof_payment_status_validation_fixed.sql';
END $$;
