# Authentication Profile Creation Fix

## Problem Description

When users sign up via phone number OTP, they are created in the `auth.users` table but corresponding profiles are not automatically created in the `public.profiles` table with their phone numbers. This causes issues where:

1. Users exist in `auth.users` but not in `public.profiles`
2. Phone numbers are not copied from `auth.users` to `public.profiles`
3. Applications that rely on the `profiles` table fail to find user data

## Root Cause Analysis

### Current Trigger Function Issue

The existing `handle_new_user()` trigger function in `supabase/migrations/20250428_database_integrity_fixes.sql` only copies the `email` field from `auth.users` to `public.profiles`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_driver, driver_status, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, false, 'pending', 'user', NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Problem**: The function doesn't include the `phone` field, so when users sign up with phone numbers, their phone numbers are not copied to the profiles table.

## Solution Implemented

### 1. Updated Trigger Function (`supabase/migrations/20250105_fix_profile_phone_creation.sql`)

The `handle_new_user()` function has been updated to include the `phone` field:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    phone,           -- ← Added phone field
    email, 
    is_driver, 
    driver_status, 
    role, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.phone,       -- ← Copy phone from auth.users
    NEW.email, 
    false, 
    'pending', 
    'user', 
    NOW(), 
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Fix Existing Data (`supabase/migrations/20250105_create_missing_profiles.sql`)

Created a migration to:
- Create profiles for existing `auth.users` that don't have corresponding profiles
- Copy phone numbers from `auth.users` to `public.profiles` for existing users

### 3. Data Cleanup

The migration also includes a cleanup step to update existing profiles that don't have phone numbers:

```sql
UPDATE public.profiles 
SET phone = auth_users.phone
FROM auth.users auth_users
WHERE public.profiles.id = auth_users.id 
  AND public.profiles.phone IS NULL 
  AND auth_users.phone IS NOT NULL;
```

## Migration Files Created

1. **`supabase/migrations/20250105_fix_profile_phone_creation.sql`**
   - Updates the `handle_new_user()` function to include phone numbers
   - Fixes existing profiles missing phone numbers
   - Recreates the trigger

2. **`supabase/migrations/20250105_create_missing_profiles.sql`**
   - Creates profiles for existing auth users without profiles
   - Ensures all users have corresponding profile entries

3. **`supabase/migrations/20250105_test_profile_creation.sql`**
   - Test function to verify the fix works correctly
   - Can be run to validate the solution

## How to Apply the Fix

### Option 1: Run Migrations (Recommended)

1. Apply the migrations in order:
   ```bash
   # Apply the main fix
   supabase db push
   ```

2. Verify the fix works by running the test:
   ```bash
   # Run the test migration
   supabase db push --include-all
   ```

### Option 2: Manual Database Update

If you prefer to apply the changes manually:

1. Connect to your Supabase database
2. Run the SQL from `20250105_fix_profile_phone_creation.sql`
3. Run the SQL from `20250105_create_missing_profiles.sql`

## Verification Steps

### 1. Check Trigger Function

```sql
-- Verify the trigger function includes phone field
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

### 2. Test New User Creation

1. Sign up a new user with phone number OTP
2. Check that a profile is created automatically:
   ```sql
   SELECT p.id, p.phone, p.email, au.phone as auth_phone
   FROM public.profiles p
   JOIN auth.users au ON p.id = au.id
   WHERE au.phone = '+237612345678'; -- Replace with test phone
   ```

### 3. Verify Existing Users

```sql
-- Check for users without profiles
SELECT COUNT(*) as users_without_profiles
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Check for profiles without phone numbers
SELECT COUNT(*) as profiles_without_phone
FROM public.profiles p
WHERE p.phone IS NULL;
```

## Expected Behavior After Fix

1. **New Users**: When a user signs up via phone OTP, a profile is automatically created with their phone number
2. **Existing Users**: Users who already exist but don't have profiles will get profiles created
3. **Phone Numbers**: All profiles will have phone numbers copied from `auth.users`

## Impact Analysis

### Positive Impacts
- ✅ Automatic profile creation for new users
- ✅ Phone numbers properly copied to profiles
- ✅ Consistent data between `auth.users` and `public.profiles`
- ✅ No breaking changes to existing functionality

### No Breaking Changes
- ✅ Existing profiles remain unchanged
- ✅ All existing functionality continues to work
- ✅ Backward compatible with current application code

## Monitoring

After applying the fix, monitor:

1. **New user registrations** - Ensure profiles are created automatically
2. **Phone number availability** - Check that phone numbers are available in profiles
3. **Application functionality** - Verify that features relying on profile phone numbers work correctly

## Rollback Plan

If issues arise, the fix can be rolled back by:

1. Reverting the trigger function to the original version
2. Removing any automatically created profiles (if needed)
3. The original migration can be found in `supabase/migrations/20250428_database_integrity_fixes.sql`

## Related Issues

This fix addresses the following related issues:
- Users not having profiles after phone OTP signup
- Missing phone numbers in profiles table
- Inconsistent data between auth and profiles tables
- Applications failing to find user phone numbers in profiles
