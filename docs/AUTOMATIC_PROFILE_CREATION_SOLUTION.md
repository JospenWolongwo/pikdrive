# Automatic Profile Creation Solution

## Overview

This document outlines the complete solution for automatically creating user profiles when users register via phone number OTP in your PikDrive application.

## Problem Statement

When users register using phone number OTP authentication, they are created in the `auth.users` table but corresponding profiles were not automatically created in the `public.profiles` table with complete information.

## Solution Components

### 1. Database Trigger Function (`supabase/migrations/20250131_comprehensive_profile_creation.sql`)

A PostgreSQL trigger function that automatically creates a complete profile when a new user is inserted into `auth.users`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, phone, email, full_name, city, avatar_url,
    is_driver, driver_status, role, driver_application_status,
    driver_application_date, is_driver_applicant,
    created_by, updated_by, created_at, updated_at
  )
  VALUES (
    NEW.id,                       -- User ID from auth.users
    NEW.phone,                    -- Phone number from registration
    NEW.email,                    -- Email (if provided)
    NULL,                         -- full_name - null until user updates
    NULL,                         -- city - null until user updates
    NULL,                         -- avatar_url - null until uploaded
    false,                        -- is_driver - default false
    'pending',                    -- driver_status - default pending
    'user',                       -- role - default user
    'pending',                    -- driver_application_status - default pending
    NULL,                         -- driver_application_date - null until applied
    false,                        -- is_driver_applicant - default false
    NULL,                         -- created_by - null for self-registration
    NULL,                         -- updated_by - null initially
    NOW(),                        -- created_at - current timestamp
    NOW()                         -- updated_at - current timestamp
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Registration Flow

Your current registration flow in `app/auth/page.tsx` handles:

1. **Phone Input**: User enters phone number
2. **OTP Request**: `signIn(formattedPhone)` sends OTP via Supabase Auth
3. **OTP Verification**: `verifyOTP(formattedPhone, code)` verifies the code
4. **Automatic Profile Creation**: When user is created in `auth.users`, the trigger automatically creates a profile

### 3. Profile Structure

Based on your JSON structure, new users get profiles with:

```json
{
  "id": "uuid-from-auth-users",
  "phone": "237698805890", // From registration
  "email": null, // null until provided
  "full_name": null, // null until user updates
  "city": null, // null until user updates
  "avatar_url": null, // null until uploaded
  "is_driver": false, // default false
  "driver_status": "pending", // default pending
  "role": "user", // default user
  "driver_application_status": "pending", // default pending
  "driver_application_date": null, // null until they apply
  "is_driver_applicant": false, // default false
  "created_by": null, // null for self-registration
  "updated_by": null, // null initially
  "created_at": "2025-01-31T...", // auto-generated
  "updated_at": "2025-01-31T..." // auto-generated
}
```

## Implementation Steps

### Step 1: Apply the Migration

Run the comprehensive profile creation migration:

```bash
cd supabase
npx supabase migration up --local
```

Or if using hosted Supabase:

```bash
npx supabase db push
```

### Step 2: Test the Registration Flow

1. Go to `/auth` page
2. Enter a phone number (e.g., `698805890`)
3. Complete OTP verification
4. Check that:
   - User is created in `auth.users`
   - Profile is automatically created in `public.profiles`
   - Profile has the phone number and default values

### Step 3: Verify with Test Script

Run the test migration to verify everything is working:

```sql
-- This is included in: supabase/migrations/20250131_test_profile_creation.sql
-- Run this to get a comprehensive report of the system status
```

## Benefits

1. **Automatic**: No manual intervention required
2. **Complete**: All necessary fields are initialized
3. **Consistent**: Every user gets a profile with proper defaults
4. **Phone-First**: Designed for phone number registration
5. **Extensible**: Easy to add more fields as needed

## User Journey

1. **Registration**: User enters phone → receives OTP → verifies code
2. **Profile Creation**: Automatic profile created with phone number
3. **Profile Update**: User can later update name, city, avatar, etc.
4. **Driver Application**: User can apply to become a driver (updates relevant fields)

## Migration History

The solution builds on previous migrations:

- `20240126_messaging.sql` - Initial profiles table
- `20250104_add_driver_application_fields.sql` - Added driver fields
- `20250105_fix_profile_phone_creation.sql` - Fixed phone number copying
- `20250428_database_integrity_fixes.sql` - Added basic trigger
- `20250131_comprehensive_profile_creation.sql` - **Complete solution**

## Verification Commands

To check if everything is working:

```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check function exists
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';

-- Check profile creation after user registration
SELECT au.phone, p.*
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id;

-- Count users vs profiles
SELECT
  (SELECT COUNT(*) FROM auth.users) as auth_users,
  (SELECT COUNT(*) FROM public.profiles) as profiles;
```

## Next Steps

1. **Apply the migration**: Deploy `20250131_comprehensive_profile_creation.sql`
2. **Test registration**: Verify new users get complete profiles
3. **Monitor**: Check that all new registrations create profiles correctly
4. **Update**: Profile completion flow can guide users to fill remaining fields

## Files Modified/Created

- ✅ `supabase/migrations/20250131_comprehensive_profile_creation.sql` - Main solution
- ✅ `supabase/migrations/20250131_test_profile_creation.sql` - Test script
- ✅ `docs/AUTOMATIC_PROFILE_CREATION_SOLUTION.md` - This documentation

The solution is now ready for deployment and testing!
