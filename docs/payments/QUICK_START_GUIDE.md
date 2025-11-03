# 🚀 Quick Start Guide: Payment Integration

**Goal:** Get your payment system working in sandbox in under 1 hour.

---

## Prerequisites

- ✅ Node.js installed
- ✅ Next.js app running
- ✅ Supabase database configured
- ✅ Basic understanding of mobile money

---

## Step-by-Step Setup (30 minutes)

### Step 1: Get MTN Sandbox Credentials (15 min)

1. **Create account:** [momodeveloper.mtn.com](https://momodeveloper.mtn.com)
   - Click "Sign Up"
   - Use your email
   - Verify email

2. **Subscribe to Collections API:**
   - Login → "Products & Services" → "Collections"
   - Click "Subscribe" (Free!)
   - Copy your **Subscription Key**

3. **Create API User:**
   - "Manage APIs" → "Collections" → "Create API User"
   - Name: "MyApp Collections"
   - **SAVE IMMEDIATELY:**
     - API User ID
     - Primary Key (shown only once!)

4. **Generate API Key:**
   - Click your API User
   - "Generate API Key"
   - **SAVE IMMEDIATELY** (shown only once!)

### Step 2: Configure Environment (5 min)

Create `.env.local` in your project root:

```env
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# MTN MOMO Sandbox
MOMO_SUBSCRIPTION_KEY=paste_your_subscription_key_here
MOMO_API_KEY=paste_your_api_key_here
MOMO_TARGET_ENVIRONMENT=sandbox
MOMO_CALLBACK_HOST=http://localhost:3000
MOMO_COLLECTION_PRIMARY_KEY=paste_your_primary_key_here
MOMO_COLLECTION_USER_ID=paste_your_api_user_id_here

# Orange Money (Optional - skip for now)
ORANGE_MONEY_MERCHANT_ID=
ORANGE_MONEY_MERCHANT_KEY=
ORANGE_MONEY_ENVIRONMENT=sandbox
ORANGE_MONEY_NOTIFICATION_URL=http://localhost:3000/api/callbacks/om
ORANGE_MONEY_RETURN_URL=http://localhost:3000/payments/status
```

**⚠️ Important:** Restart your dev server after creating this file!

### Step 3: Test Basic Payment (5 min)

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to booking page:**
   - Should see MTN Mobile Money option

3. **Make test payment:**
   - Payment method: MTN Mobile Money
   - Phone: `237670000000` (MTN test number)
   - Amount: 1000 FCFA
   - Click "Pay"

4. **Expected:**
   - ✅ "Payment request sent" message
   - ✅ Status shows "processing"

### Step 4: Approve in Sandbox (5 min)

1. **Go to MTN Portal:**
   - Login to [momodeveloper.mtn.com](https://momodeveloper.mtn.com)
   - "Collections" → "Operations"
   - Find your transaction

2. **Approve transaction:**
   - Click "Approve" button
   - Wait a few seconds

3. **Check your app:**
   - ✅ Payment status: "completed"
   - ✅ Booking updated
   - ✅ Notification sent

---

## 🎯 Success Criteria

After completing above steps, you should have:

- ✅ Payment request sent successfully
- ✅ Transaction visible in MTN portal
- ✅ Callback received (status → "completed")
- ✅ Booking status updated
- ✅ User notification sent

---

## ⚠️ Common First-Time Issues

### "Missing environment variable"

**Fix:**
1. Check `.env.local` is in project root
2. Restart dev server: `Ctrl+C` then `npm run dev`
3. Check variable names match exactly

### "Invalid credentials"

**Fix:**
1. Copy credentials from MTN portal again
2. Remove any spaces before/after values
3. Check subscription is active (not expired)

### "Callback not received"

**Fix:**
1. Open terminal - should see "Callback received"
2. Check server is running on port 3000
3. Try approving again in MTN portal

---

## 📖 What's Next?

Now that basic payment works:

1. **Test all scenarios:**
   - Approve payment (done ✅)
   - Reject payment
   - Payment timeout
   - See [SANDBOX_TESTING_CHECKLIST.md](./SANDBOX_TESTING_CHECKLIST.md)

2. **Add Orange Money** (optional):
   - Follow same steps with Orange sandbox
   - See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)

3. **Test Edge Cases:**
   - Invalid phone numbers
   - Duplicate payments
   - Network failures

4. **Prepare for Production:**
   - Complete all tests
   - Document results
   - Request production credentials

---

## 🆘 Need Help?

**Issue not resolved?**

1. **Check logs:** Look for error messages in terminal
2. **Read:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) (if exists)
3. **Community:** MTN Developer Forum
4. **Support:** Contact MTN Developer Support

---

## 📚 Complete Documentation

- **Environment Setup:** [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)
- **Testing:** [SANDBOX_TESTING_CHECKLIST.md](./SANDBOX_TESTING_CHECKLIST.md)
- **Architecture:** [../IMPLEMENTATION_COMPLETE.md](../IMPLEMENTATION_COMPLETE.md)

---

**✨ You're ready to start! Begin with Step 1 above.**

Good luck! 🚀

