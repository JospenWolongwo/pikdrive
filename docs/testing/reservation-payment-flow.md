# Reservation-Payment Flow Testing Guide

## Prerequisites
1. Local development environment set up
2. `.env.local` configured with:
   - Supabase credentials
   - MTN MOMO sandbox credentials
   - Orange Money sandbox credentials
   - Twilio sandbox credentials

## Test Flow 1: Successful Payment

### Step 1: Create Reservation
1. Log in as a user
2. Navigate to `/rides`
3. Select a ride and number of seats
4. Click "Continue to Payment"
   - **Expected**: Booking is created with status "pending"
   - **Verify**: Check Supabase `bookings` table

### Step 2: Payment Process
1. Choose payment method (MTN MOMO or Orange Money)
2. Enter test phone number:
   - MTN MOMO: `237677777777` (success)
   - Orange Money: `237699999999` (success)
3. Click "Pay Now"
   - **Expected**: 
     - Payment record created in `payments` table
     - Status starts as "pending"
     - User redirected to `/payments/status`
   - **Verify**: Check browser console for 🔄 status check logs

### Step 3: Status Updates
1. Wait for status polling (every 3 seconds)
   - **Expected**: Status changes:
     ```
     pending → processing → completed
     ```
   - **Verify**: 
     - Check `/payments/status` page
     - Monitor browser console for 📦 status updates

### Step 4: Notifications
1. After successful payment:
   - **Expected**: 
     - SMS sent to user's phone (in sandbox)
     - ✅ Success icon shown on status page
     - Redirect to booking page after 3 seconds
   - **Verify**: 
     - Check Twilio console for test messages
     - Monitor browser console for 📱 SMS logs

### Step 5: Final State
1. Check booking status
   - **Expected**: 
     - Booking status updated to "confirmed"
     - Seats deducted from ride
     - Receipt generated
   - **Verify**: 
     - Check Supabase tables
     - View booking details page

## Test Flow 2: Failed Payment

### Steps 1-2: Same as Success Flow
But use these test numbers:
- MTN MOMO: `237666666666` (rejected)
- Orange Money: `237688888888` (rejected)

### Step 3: Status Updates
- **Expected**: Status changes:
  ```
  pending → failed
  ```
- **Verify**: 
  - ❌ Error icon shown on status page
  - Error message displayed
  - Failure SMS sent (check Twilio console)

### Step 4: Recovery
1. Click "Try Again"
   - **Expected**: 
     - New payment attempt possible
     - Old payment marked as failed
     - Booking still in pending state

## Test Flow 3: Timeout Scenario
Use test numbers:
- MTN MOMO: `237633333333`
- Orange Money: `237611111111`

- **Expected**:
  - Payment times out after 5 minutes
  - Background job marks it as failed
  - Notification sent to user
  - Booking remains in pending state

## Common Issues & Debugging

### Payment Not Starting
1. Check browser console for errors
2. Verify environment variables
3. Ensure test phone numbers are correct format

### Status Not Updating
1. Check browser network tab
2. Verify polling requests are happening
3. Check server logs for API responses

### SMS Not Received
1. Verify Twilio sandbox mode
2. Check server logs for 📱 emoji
3. Verify phone number format

## Testing Checklist
- [ ] Successful payment flow (MTN)
- [ ] Successful payment flow (Orange)
- [ ] Failed payment (user rejection)
- [ ] Failed payment (insufficient funds)
- [ ] Payment timeout
- [ ] SMS notifications
- [ ] Receipt generation
- [ ] Booking status updates
- [ ] Seat availability updates

---
Last Updated: March 28, 2025
