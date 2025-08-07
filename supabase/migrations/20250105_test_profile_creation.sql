-- Test migration to verify profile creation with phone numbers works correctly
-- This migration can be run to test the fix

-- Test function to verify profile creation
CREATE OR REPLACE FUNCTION test_profile_creation()
RETURNS TEXT AS $$
DECLARE
  test_user_id UUID;
  test_phone TEXT := '+237612345678';
  test_email TEXT := 'test@example.com';
  profile_count INTEGER;
  profile_phone TEXT;
BEGIN
  -- Create a test user in auth.users (this would normally be done by Supabase Auth)
  -- Note: This is just for testing - in real scenarios, users are created via Supabase Auth
  INSERT INTO auth.users (
    id,
    phone,
    email,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    test_phone,
    test_email,
    NOW(),
    NOW()
  ) RETURNING id INTO test_user_id;
  
  -- Check if profile was created automatically
  SELECT COUNT(*) INTO profile_count
  FROM public.profiles
  WHERE id = test_user_id;
  
  IF profile_count = 0 THEN
    RETURN 'FAIL: Profile was not created automatically';
  END IF;
  
  -- Check if phone number was copied correctly
  SELECT phone INTO profile_phone
  FROM public.profiles
  WHERE id = test_user_id;
  
  IF profile_phone IS NULL OR profile_phone != test_phone THEN
    RETURN 'FAIL: Phone number was not copied correctly. Expected: ' || test_phone || ', Got: ' || COALESCE(profile_phone, 'NULL');
  END IF;
  
  -- Clean up test data
  DELETE FROM public.profiles WHERE id = test_user_id;
  DELETE FROM auth.users WHERE id = test_user_id;
  
  RETURN 'PASS: Profile creation with phone number works correctly';
END;
$$ LANGUAGE plpgsql;

-- Run the test
SELECT test_profile_creation();

-- Clean up test function
DROP FUNCTION test_profile_creation();
