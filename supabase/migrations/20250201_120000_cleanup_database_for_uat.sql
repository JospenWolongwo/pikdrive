-- Database Cleanup Script for UAT
-- Purpose: Delete all users and their related data except the superadmin user
-- 
-- WARNING: This script will permanently delete all user data except the superadmin!
-- Make sure you have a backup before running this script.
-- 
-- To rollback: Restore from backup (this operation cannot be undone)
--
-- Superadmin Identification:
-- - ID: 8821b7c8-53b9-4952-8b38-bcdcc1c27046
-- - Email: user@example.com
-- - Role: admin

DO $$
DECLARE
  superadmin_id UUID := '8821b7c8-53b9-4952-8b38-bcdcc1c27046';
  superadmin_email TEXT := 'user@example.com';
  users_count_before INTEGER;
  users_count_after INTEGER;
  profiles_count_before INTEGER;
  profiles_count_after INTEGER;
  bookings_count_before INTEGER;
  bookings_count_after INTEGER;
  rides_count_before INTEGER;
  rides_count_after INTEGER;
  payments_count_before INTEGER;
  payments_count_after INTEGER;
  messages_count_before INTEGER;
  messages_count_after INTEGER;
  webhook_logs_count_before INTEGER;
  webhook_logs_count_after INTEGER;
  remaining_bookings_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATABASE CLEANUP FOR UAT';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Safety check: Verify superadmin exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = superadmin_id) THEN
    RAISE EXCEPTION 'Superadmin user not found! Aborting cleanup. Expected ID: %', superadmin_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = superadmin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Superadmin profile not found or role is not admin! Aborting cleanup.';
  END IF;

  RAISE NOTICE '✅ Safety checks passed - Superadmin found';
  RAISE NOTICE 'Superadmin ID: %', superadmin_id;
  RAISE NOTICE 'Superadmin Email: %', superadmin_email;
  RAISE NOTICE '';

  -- Count records before deletion
  SELECT COUNT(*) INTO users_count_before FROM auth.users WHERE id != superadmin_id;
  SELECT COUNT(*) INTO profiles_count_before FROM public.profiles WHERE id != superadmin_id;
  SELECT COUNT(*) INTO bookings_count_before FROM public.bookings WHERE user_id != superadmin_id;
  SELECT COUNT(*) INTO rides_count_before FROM public.rides WHERE driver_id != superadmin_id;
  SELECT COUNT(*) INTO payments_count_before FROM public.payments 
    WHERE booking_id IN (SELECT id FROM public.bookings WHERE user_id != superadmin_id);
  SELECT COUNT(*) INTO messages_count_before FROM public.messages 
    WHERE sender_id != superadmin_id;
  SELECT COUNT(*) INTO webhook_logs_count_before FROM public.onesignal_webhook_logs 
    WHERE user_id != superadmin_id::TEXT;

  RAISE NOTICE '📊 Records to be deleted:';
  RAISE NOTICE '  - Users (auth.users): %', users_count_before;
  RAISE NOTICE '  - Profiles: %', profiles_count_before;
  RAISE NOTICE '  - Bookings: %', bookings_count_before;
  RAISE NOTICE '  - Rides: %', rides_count_before;
  RAISE NOTICE '  - Payments: %', payments_count_before;
  RAISE NOTICE '  - Messages: %', messages_count_before;
  RAISE NOTICE '  - OneSignal Webhook Logs: %', webhook_logs_count_before;
  RAISE NOTICE '';

  -- Step 1: Delete OneSignal webhook logs (no FK constraint, manual cleanup)
  RAISE NOTICE 'Step 1: Cleaning OneSignal webhook logs...';
  DELETE FROM public.onesignal_webhook_logs 
  WHERE user_id != superadmin_id::TEXT OR user_id IS NULL;
  GET DIAGNOSTICS webhook_logs_count_after = ROW_COUNT;
  RAISE NOTICE '  ✅ Deleted % webhook log entries', webhook_logs_count_after;

  -- Step 2: CRITICAL - Delete ALL bookings for rides from non-superadmin drivers FIRST
  -- This must happen BEFORE deleting users/rides to avoid FK constraint violations
  -- We delete bookings where the ride's driver is not the superadmin, regardless of who made the booking
  RAISE NOTICE 'Step 2: Deleting bookings for rides from non-superadmin drivers...';
  DELETE FROM public.bookings 
  WHERE ride_id IN (
    SELECT id FROM public.rides WHERE driver_id != superadmin_id
  );
  GET DIAGNOSTICS bookings_count_after = ROW_COUNT;
  RAISE NOTICE '  ✅ Deleted % bookings for non-superadmin rides', bookings_count_after;

  -- Step 3: Delete all users except superadmin
  -- This will cascade to:
  --   - profiles (ON DELETE CASCADE)
  --   - bookings (ON DELETE CASCADE) - but we already deleted most of them
  --   - notification_logs (ON DELETE CASCADE)
  --   - users table (legacy, ON DELETE CASCADE)
  -- And via profiles cascade:
  --   - rides (driver_id ON DELETE CASCADE)
  --   - driver_documents (driver_id ON DELETE CASCADE)
  --   - conversations (participants array - manual cleanup needed)
  --   - messages (sender_id ON DELETE CASCADE)
  --   - push_subscriptions (user_id ON DELETE CASCADE)
  --   - payouts (driver_id ON DELETE CASCADE)
  -- And via bookings cascade:
  --   - payments (booking_id ON DELETE CASCADE)
  --   - payment_receipts (payment_id ON DELETE CASCADE)
  
  RAISE NOTICE 'Step 3: Deleting users (this will cascade to all related data)...';
  DELETE FROM auth.users WHERE id != superadmin_id;
  GET DIAGNOSTICS users_count_after = ROW_COUNT;
  RAISE NOTICE '  ✅ Deleted % users', users_count_after;

  -- Step 4: Clean up any orphaned records (safety measure)
  -- IMPORTANT: Delete in correct order to respect foreign key constraints
  RAISE NOTICE 'Step 4: Cleaning up orphaned records...';
  
  -- Step 4a: Delete any remaining bookings for non-superadmin users (safety check)
  RAISE NOTICE '  Step 4a: Deleting remaining bookings for non-superadmin users...';
  DELETE FROM public.bookings 
  WHERE user_id != superadmin_id;
  
  -- Step 4b: Verify no bookings remain for non-superadmin rides (critical check)
  RAISE NOTICE '  Step 4b: Verifying all bookings deleted...';
  SELECT COUNT(*) INTO remaining_bookings_count
  FROM public.bookings b
  INNER JOIN public.rides r ON b.ride_id = r.id
  WHERE r.driver_id != superadmin_id;
  
  IF remaining_bookings_count > 0 THEN
    RAISE EXCEPTION 'CRITICAL: % bookings still exist for non-superadmin rides. Cannot proceed with ride deletion.', remaining_bookings_count;
  END IF;
  
  RAISE NOTICE '  ✅ Verification passed - no bookings remain for non-superadmin rides';
  
  -- Step 4c: Clean up payments and receipts
  RAISE NOTICE '  Step 4c: Cleaning up orphaned payments...';
  DELETE FROM public.payments 
  WHERE booking_id NOT IN (SELECT id FROM public.bookings);
  
  RAISE NOTICE '  Step 4d: Cleaning up orphaned payment receipts...';
  DELETE FROM public.payment_receipts 
  WHERE payment_id NOT IN (SELECT id FROM public.payments);
  
  -- Step 4e: Now safe to delete rides (all bookings that referenced them are deleted)
  RAISE NOTICE '  Step 4e: Deleting rides from non-superadmin drivers...';
  DELETE FROM public.rides 
  WHERE driver_id != superadmin_id;
  
  -- Clean up any conversations where participants include deleted users
  -- The conversations table uses participants UUID[] array
  DELETE FROM public.conversations 
  WHERE EXISTS (
    SELECT 1 FROM unnest(participants) AS participant_id
    WHERE participant_id != superadmin_id 
      AND participant_id NOT IN (SELECT id FROM public.profiles)
  );
  
  -- Clean up any messages in conversations that no longer exist
  DELETE FROM public.messages 
  WHERE conversation_id NOT IN (SELECT id FROM public.conversations);
  
  -- Clean up any payouts for drivers that no longer exist
  DELETE FROM public.payouts 
  WHERE driver_id != superadmin_id AND driver_id NOT IN (SELECT id FROM public.profiles);
  
  RAISE NOTICE '  ✅ Cleaned up orphaned records';

  -- Count records after deletion
  SELECT COUNT(*) INTO users_count_after FROM auth.users WHERE id != superadmin_id;
  SELECT COUNT(*) INTO profiles_count_after FROM public.profiles WHERE id != superadmin_id;
  SELECT COUNT(*) INTO bookings_count_after FROM public.bookings WHERE user_id != superadmin_id;
  SELECT COUNT(*) INTO rides_count_after FROM public.rides WHERE driver_id != superadmin_id;
  SELECT COUNT(*) INTO payments_count_after FROM public.payments 
    WHERE booking_id IN (SELECT id FROM public.bookings WHERE user_id != superadmin_id);
  SELECT COUNT(*) INTO messages_count_after FROM public.messages 
    WHERE sender_id != superadmin_id;
  SELECT COUNT(*) INTO webhook_logs_count_after FROM public.onesignal_webhook_logs 
    WHERE user_id != superadmin_id::TEXT;

  RAISE NOTICE '';
  RAISE NOTICE '📊 Cleanup Summary:';
  RAISE NOTICE '  - Users remaining: % (should be 0)', users_count_after;
  RAISE NOTICE '  - Profiles remaining: % (should be 1 - superadmin only)', profiles_count_after;
  RAISE NOTICE '  - Bookings remaining: % (should be 0)', bookings_count_after;
  RAISE NOTICE '  - Rides remaining: % (should be 0 or superadmin rides only)', rides_count_after;
  RAISE NOTICE '  - Payments remaining: % (should be 0)', payments_count_after;
  RAISE NOTICE '  - Messages remaining: % (should be 0)', messages_count_after;
  RAISE NOTICE '  - Webhook logs remaining: % (should be 0)', webhook_logs_count_after;
  RAISE NOTICE '';

  -- Verify superadmin still exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = superadmin_id) THEN
    RAISE EXCEPTION 'CRITICAL ERROR: Superadmin was deleted! This should never happen.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = superadmin_id) THEN
    RAISE EXCEPTION 'CRITICAL ERROR: Superadmin profile was deleted! This should never happen.';
  END IF;

  RAISE NOTICE '✅ Verification passed - Superadmin preserved';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATABASE CLEANUP COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'The database is now clean and ready for UAT testing.';
  RAISE NOTICE 'Only the superadmin user remains: %', superadmin_email;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error during cleanup: %', SQLERRM;
END $$;

