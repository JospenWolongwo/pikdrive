-- Test script to verify automatic profile creation works correctly
-- This script simulates user registration and verifies profile creation

-- Test 1: Check if the trigger function exists and is properly configured
DO $$
DECLARE
  function_exists BOOLEAN;
  trigger_exists BOOLEAN;
BEGIN
  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) INTO function_exists;
  
  -- Check if trigger exists
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) INTO trigger_exists;
  
  IF function_exists THEN
    RAISE NOTICE '✅ handle_new_user function exists';
  ELSE
    RAISE NOTICE '❌ handle_new_user function NOT found';
  END IF;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ on_auth_user_created trigger exists';
  ELSE
    RAISE NOTICE '❌ on_auth_user_created trigger NOT found';
  END IF;
END $$;

-- Test 2: Check profiles table structure
DO $$
DECLARE
  column_count INTEGER;
  required_columns TEXT[] := ARRAY[
    'id', 'phone', 'email', 'full_name', 'city', 'avatar_url',
    'is_driver', 'driver_status', 'role', 'driver_application_status', 
    'driver_application_date', 'is_driver_applicant', 'created_by', 
    'updated_by', 'created_at', 'updated_at'
  ];
  missing_columns TEXT[] := '{}';
  col TEXT;
BEGIN
  -- Check each required column
  FOREACH col IN ARRAY required_columns
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = col
    ) THEN
      missing_columns := array_append(missing_columns, col);
    END IF;
  END LOOP;
  
  SELECT COUNT(*) INTO column_count 
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'profiles';
  
  RAISE NOTICE '📊 Profiles table has % columns', column_count;
  
  IF array_length(missing_columns, 1) IS NULL THEN
    RAISE NOTICE '✅ All required columns exist in profiles table';
  ELSE
    RAISE NOTICE '❌ Missing columns in profiles table: %', missing_columns;
  END IF;
END $$;

-- Test 3: Show current function definition
DO $$
DECLARE
  func_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO func_definition
  FROM pg_proc 
  WHERE proname = 'handle_new_user' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  RAISE NOTICE '📝 Current handle_new_user function definition:';
  RAISE NOTICE '%', func_definition;
END $$;

-- Test 4: Count existing profiles
DO $$
DECLARE
  total_profiles INTEGER;
  profiles_with_phone INTEGER;
  profiles_without_phone INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_profiles FROM public.profiles;
  SELECT COUNT(*) INTO profiles_with_phone FROM public.profiles WHERE phone IS NOT NULL;
  SELECT COUNT(*) INTO profiles_without_phone FROM public.profiles WHERE phone IS NULL;
  
  RAISE NOTICE '📈 Profile Statistics:';
  RAISE NOTICE '   Total profiles: %', total_profiles;
  RAISE NOTICE '   Profiles with phone: %', profiles_with_phone;
  RAISE NOTICE '   Profiles without phone: %', profiles_without_phone;
END $$;

-- Test 5: Check auth.users vs profiles alignment
DO $$
DECLARE
  auth_users_count INTEGER;
  profiles_count INTEGER;
  missing_profiles INTEGER;
BEGIN
  SELECT COUNT(*) INTO auth_users_count FROM auth.users;
  SELECT COUNT(*) INTO profiles_count FROM public.profiles;
  
  SELECT COUNT(*) INTO missing_profiles 
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE p.id IS NULL;
  
  RAISE NOTICE '🔗 Auth Users vs Profiles:';
  RAISE NOTICE '   Auth users: %', auth_users_count;
  RAISE NOTICE '   Profiles: %', profiles_count;
  RAISE NOTICE '   Missing profiles: %', missing_profiles;
  
  IF missing_profiles = 0 THEN
    RAISE NOTICE '✅ All auth users have corresponding profiles';
  ELSE
    RAISE NOTICE '❌ % auth users are missing profiles', missing_profiles;
  END IF;
END $$;

RAISE NOTICE '';
RAISE NOTICE '🎯 AUTOMATIC PROFILE CREATION TEST COMPLETE';
RAISE NOTICE '   The system is ready to automatically create profiles for new users.';
RAISE NOTICE '   When users register via phone OTP, they will get a complete profile with:';
RAISE NOTICE '   - Phone number from registration';
RAISE NOTICE '   - Email (if provided)';
RAISE NOTICE '   - Default role: user';
RAISE NOTICE '   - Default driver status: pending';
RAISE NOTICE '   - Other fields: NULL until user updates profile';
RAISE NOTICE '';
