# Fix for seats_available Field Not Updating

## Problem Description

The `seats_available` field in the `rides` table is not being automatically updated when bookings are created, updated, or deleted. This causes:

1. **UI inconsistency**: The driver dashboard shows incorrect available seats
2. **Delete button enabled**: Rides with bookings can still be deleted because the UI shows wrong information
3. **Data integrity issues**: The database state doesn't match the actual booking situation

## Root Cause

There are **no database triggers** to automatically update `seats_available` when:

- A new booking is created
- A booking is updated (e.g., seat count changes)
- A booking is deleted

The only existing triggers are:

- `update_seats_after_payment` - only triggers on payment completion
- `cancel_booking_and_restore_seats` - only triggers on booking cancellation

## Solution

### 1. Add Automatic Seats Management Triggers

**File**: `supabase/migrations/20250221_add_booking_seats_trigger.sql`

This migration creates triggers that automatically:

- Reduce `seats_available` when a booking is created
- Increase `seats_available` when a booking is deleted
- Adjust `seats_available` when a booking's seat count changes

### 2. Fix Existing Data

**File**: `supabase/migrations/20250221_fix_existing_seats.sql`

This migration recalculates and fixes all existing rides with incorrect `seats_available` values by:

- Counting actual active bookings for each ride
- Recalculating `seats_available` based on original seats minus booked seats

### 3. Update Frontend Logic

**Files Modified**:

- `components/driver/dashboard/ride-card.tsx` - Simplified `canDeleteRide()` logic
- `app/driver/dashboard/page.tsx` - Simplified delete validation
- `app/driver/rides/[id]/page.tsx` - Fixed booking detection logic

## How to Apply the Fix

### Option 1: Run Migrations (Recommended)

1. Apply the trigger migration:

   ```sql
   -- Run the migration file
   \i supabase/migrations/20250221_add_booking_seats_trigger.sql
   ```

2. Fix existing data (choose one):

   ```sql
   -- Option A: Simple direct update (recommended)
   \i supabase/migrations/20250221_fix_existing_seats_simple.sql

   -- Option B: Complex function-based approach
   \i supabase/migrations/20250221_fix_existing_seats.sql
   ```

### Option 2: Manual SQL Commands

1. Create the trigger function:

   ```sql
   -- Copy the function from the migration file
   ```

2. Fix existing rides:
   ```sql
   -- Update each ride manually
   UPDATE rides
   SET seats_available = (
     SELECT GREATEST(0, seats_available + COALESCE(SUM(seats), 0))
     FROM bookings
     WHERE ride_id = rides.id
     AND status NOT IN ('cancelled', 'rejected')
   );
   ```

## Testing the Fix

1. **Check current state**:

   ```sql
   -- Run the test script
   \i scripts/test-booking-seats.sql
   ```

2. **Create a test booking** and verify `seats_available` decreases automatically

3. **Delete a test booking** and verify `seats_available` increases automatically

4. **Check the driver dashboard** - delete button should be disabled for rides with bookings

## Expected Behavior After Fix

- ✅ `seats_available` automatically updates when bookings are created/deleted
- ✅ Driver dashboard shows correct available seats
- ✅ Delete button is properly disabled for rides with any bookings
- ✅ Data consistency between `rides` and `bookings` tables

## Notes

- The fix assumes that `seats_available` represents the actual available seats
- Cancelled/rejected bookings don't count against available seats
- The triggers use `GREATEST(0, ...)` to prevent negative seat counts
- All seat updates are logged for debugging purposes

## Troubleshooting

### Error: "column 'status' does not exist"

If you encounter this error when running the complex migration, it means your `rides` table doesn't have a `status` column. Use the simple migration instead:

```sql
-- Use this simpler migration instead
\i supabase/migrations/20250221_fix_existing_seats_simple.sql
```

The simple migration directly updates the `seats_available` field without relying on complex functions or non-existent columns.
