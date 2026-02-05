# PikDrive Database Schema

## 📋 Overview

This document provides a comprehensive overview of the PikDrive database schema, including all tables, relationships, and Row Level Security (RLS) policies.

**Database**: PostgreSQL (via Supabase)  
**Last Updated**: February 2025

---

## 📊 Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   profiles  │◄──────│   bookings   │──────►│    rides    │
│             │       │              │       │             │
│  - id (PK)  │       │  - id (PK)   │       │  - id (PK)  │
│  - phone    │       │  - user_id   │       │  - driver_id│
│  - role     │       │  - ride_id   │       │  - from_city│
│  - is_driver│       │  - seats     │       │  - to_city  │
└─────────────┘       │  - status    │       │  - price    │
       │              │  - payment_id│       │  - seats    │
       │              └──────┬───────┘       └─────────────┘
       │                     │                      │
       ├─────────────────────┼──────────────────────┘
       │                     │
       ▼                     ▼
┌─────────────┐       ┌──────────────┐
│driver_docs  │       │   payments   │
│             │       │              │
│  - id (PK)  │       │  - id (PK)   │
│  - driver_id│       │  - booking_id│
│  - doc_type │       │  - amount    │
│  - status   │       │  - status    │
└─────────────┘       │  - provider  │
                      └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │   receipts   │
                      │              │
                      │  - id (PK)   │
                      │  - payment_id│
                      │  - receipt_no│
                      └──────────────┘
```

---

## 📁 Core Tables

### 1. **profiles**

User profiles table storing both passengers and drivers.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT UNIQUE,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'driver', 'admin')),
  
  -- Driver-specific fields
  is_driver BOOLEAN DEFAULT FALSE,
  driver_status TEXT CHECK (driver_status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_driver_applicant BOOLEAN DEFAULT FALSE,
  driver_application_date TIMESTAMP WITH TIME ZONE,
  driver_application_status TEXT,
  driver_approval_date TIMESTAMP WITH TIME ZONE,
  
  -- User settings
  preferred_language TEXT DEFAULT 'fr',
  theme TEXT DEFAULT 'system',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_profiles_is_driver ON public.profiles(is_driver);
CREATE INDEX idx_profiles_driver_status ON public.profiles(driver_status);
```

**RLS Policies:**
- ✅ `profiles_select_own` - Users can view their own profile
- ✅ `profiles_select_drivers` - Anyone can view approved drivers
- ✅ `profiles_update_own` - Users can update their own profile
- ✅ `profiles_insert_own` - Users can create their own profile

---

### 2. **driver_documents**

Driver verification documents (ID, license, insurance, vehicle images).

```sql
CREATE TABLE public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Document fields
  id_card_front TEXT,
  id_card_back TEXT,
  drivers_license_front TEXT,
  drivers_license_back TEXT,
  vehicle_insurance TEXT,
  vehicle_images TEXT[],
  
  -- Verification
  verification_status TEXT DEFAULT 'pending' 
    CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(driver_id)
);

-- Indexes
CREATE INDEX idx_driver_documents_driver_id ON public.driver_documents(driver_id);
CREATE INDEX idx_driver_documents_status ON public.driver_documents(verification_status);
```

**RLS Policies:**
- ✅ `driver_documents_select_own` - Drivers can view their own documents
- ✅ `driver_documents_select_admin` - Admins can view all documents
- ✅ `driver_documents_insert_own` - Drivers can upload their documents
- ✅ `driver_documents_update_own` - Drivers can update their documents
- ✅ `driver_documents_update_admin` - Admins can update verification status

---

### 3. **rides**

Published rides created by drivers.

```sql
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Route information
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  description TEXT,
  
  -- Schedule
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_duration INTEGER, -- in minutes
  
  -- Capacity and pricing
  seats_available INTEGER NOT NULL CHECK (seats_available >= 0),
  total_seats INTEGER NOT NULL CHECK (total_seats > 0),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  currency TEXT DEFAULT 'XAF',
  
  -- Status
  status TEXT DEFAULT 'upcoming' 
    CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled')),
  
  -- Pickup points: JSONB array of { id, order, time_offset_minutes }; id references city_pickup_points.id (Phase 1: admin-owned points per city)
  pickup_points JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CHECK (seats_available <= total_seats)
);

-- Indexes
CREATE INDEX idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX idx_rides_departure_time ON public.rides(departure_time);
CREATE INDEX idx_rides_status ON public.rides(status);
CREATE INDEX idx_rides_from_city ON public.rides(from_city);
CREATE INDEX idx_rides_to_city ON public.rides(to_city);
CREATE INDEX idx_rides_search ON public.rides(from_city, to_city, departure_time);
```

**RLS Policies:**
- ✅ `rides_select_all` - Anyone can view published rides
- ✅ `rides_insert_driver` - Drivers can create rides
- ✅ `rides_update_own` - Drivers can update their own rides
- ✅ `rides_delete_own` - Drivers can delete their own rides (if no bookings)

**Note on pickup_points:** Each element in the array stores only `id` (UUID referencing `city_pickup_points.id`), `order`, and `time_offset_minutes`. Names are resolved from `city_pickup_points` when returning rides via API (enrichment). Legacy rides may still have `name` in the JSON.

---

### 4. **city_pickup_points**

Admin-defined meeting/pickup points per city. Drivers select from these when creating or editing a ride (no free-form names).

```sql
CREATE TABLE public.city_pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city, name)
);

CREATE INDEX idx_city_pickup_points_city ON public.city_pickup_points(city);
```

**RLS Policies:**
- SELECT: authenticated and anon (so drivers can read for ride creation)
- INSERT/UPDATE/DELETE: admin only (via profiles.role = 'admin')

---

### 5. **bookings**

Passenger bookings for rides.

```sql
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Booking details
  seats INTEGER NOT NULL CHECK (seats > 0),
  
  -- Status
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'pending_verification', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  
  -- Verification
  verification_code TEXT,
  code_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(ride_id, user_id) -- One booking per user per ride
);

-- Indexes
CREATE INDEX idx_bookings_ride_id ON public.bookings(ride_id);
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_verification_code ON public.bookings(verification_code);
```

**RLS Policies:**
- ✅ `bookings_select_own` - Users can view their own bookings
- ✅ `bookings_select_driver` - Drivers can view bookings for their rides
- ✅ `bookings_insert_own` - Users can create bookings
- ✅ `bookings_update_own` - Users can update their bookings
- ✅ `bookings_delete_own` - Users can cancel their bookings

---

### 6. **payments**

Payment records for bookings.

```sql
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  
  -- Payment details
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'XAF',
  
  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  
  -- Provider information
  payment_method TEXT NOT NULL 
    CHECK (payment_method IN ('momo', 'orange', 'card', 'cash', 'bank_transfer')),
  transaction_id TEXT,
  
  -- Phone number for mobile money
  phone_number TEXT,
  
  -- Idempotency
  idempotency_key TEXT UNIQUE,
  
  -- Provider response
  provider_response JSONB,
  error_message TEXT,
  
  -- Timestamps
  payment_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_idempotency_key ON public.payments(idempotency_key);
```

**RLS Policies:**
- ✅ `payments_select_own` - Users can view payments for their bookings
- ✅ `payments_select_driver` - Drivers can view payments for their rides
- ✅ `payments_insert_own` - Users can create payments for their bookings
- ✅ `payments_update_system` - Only system can update payment status

---

### 7. **payment_receipts**

Payment receipts generated after successful payments.

```sql
CREATE TABLE public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  
  -- Receipt details
  receipt_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(payment_id)
);

-- Indexes
CREATE INDEX idx_payment_receipts_payment_id ON public.payment_receipts(payment_id);
CREATE INDEX idx_payment_receipts_number ON public.payment_receipts(receipt_number);
```

**RLS Policies:**
- ✅ `receipts_select_own` - Users can view receipts for their payments

---

### 7. **conversations**

Chat conversations between users.

```sql
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  
  -- Participants
  participant_1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Last message info
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (participant_1_id < participant_2_id), -- Enforce order
  UNIQUE(participant_1_id, participant_2_id, ride_id)
);

-- Indexes
CREATE INDEX idx_conversations_participant_1 ON public.conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON public.conversations(participant_2_id);
CREATE INDEX idx_conversations_ride_id ON public.conversations(ride_id);
```

**RLS Policies:**
- ✅ `conversations_select_participant` - Users can view their conversations
- ✅ `conversations_insert_participant` - Users can create conversations
- ✅ `conversations_update_participant` - Users can update their conversations

---

### 9. **messages**

Individual messages in conversations.

```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  
  -- Read status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
```

**RLS Policies:**
- ✅ `messages_select_conversation` - Users can view messages in their conversations
- ✅ `messages_insert_own` - Users can send messages in their conversations
- ✅ `messages_update_own` - Users can update read status

---

### 10. **push_subscriptions**

Push notification subscriptions for web push notifications.

```sql
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Subscription details
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  
  -- Device info
  user_agent TEXT,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(endpoint)
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_active ON public.push_subscriptions(active);
```

**RLS Policies:**
- ✅ `push_subscriptions_select_own` - Users can view their subscriptions
- ✅ `push_subscriptions_insert_own` - Users can create subscriptions
- ✅ `push_subscriptions_update_own` - Users can update their subscriptions
- ✅ `push_subscriptions_delete_own` - Users can delete their subscriptions

---

## 🔐 Row Level Security (RLS) Policies

### Global Rules

1. **Users can view their own data** - Across all tables
2. **Drivers can view bookings/payments for their rides** - For business operations
3. **Admins have full access** - For moderation and support
4. **Public data is readable by all** - Ride listings, driver profiles

### Security Principles

- ✅ All tables have RLS enabled
- ✅ Policies use `auth.uid()` for user identification
- ✅ No policy allows unrestricted access
- ✅ Admin access controlled via `role` column
- ✅ Sensitive data (documents, payments) restricted to owners and admins

---

## 🔄 Database Triggers

### 1. **handle_new_user()**
**Purpose**: Automatically create profile when user signs up  
**Trigger**: `AFTER INSERT ON auth.users`  
**Action**: Creates profile with phone/email from auth.users

### 2. **update_seats_after_booking()**
**Purpose**: Update ride seats when booking created  
**Trigger**: `AFTER INSERT ON bookings`  
**Action**: Decrements `seats_available` in rides table

### 3. **restore_seats_after_cancellation()**
**Purpose**: Restore seats when booking cancelled  
**Trigger**: `AFTER UPDATE ON bookings` (when status = 'cancelled')  
**Action**: Increments `seats_available` in rides table

### 4. **update_seats_after_payment()**
**Purpose**: Confirm booking after successful payment  
**Trigger**: `AFTER UPDATE ON payments` (when status = 'completed')  
**Action**: Updates booking status to 'pending_verification'

### 5. **generate_booking_verification_code()**
**Purpose**: Generate 6-digit verification code for bookings  
**Trigger**: Called via RPC after payment  
**Action**: Creates unique verification code

### 6. **update_conversation_on_message()**
**Purpose**: Update conversation's last message info  
**Trigger**: `AFTER INSERT ON messages`  
**Action**: Updates `last_message_at` and `last_message_preview`

---

## 🔧 Database Functions (RPC)

### 1. **cancel_booking_and_restore_seats(p_booking_id)**
Cancels a booking and restores ride seats atomically.

```sql
CREATE OR REPLACE FUNCTION cancel_booking_and_restore_seats(p_booking_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE rides
  SET seats_available = seats_available + (
    SELECT seats FROM bookings WHERE id = p_booking_id
  )
  WHERE id = (SELECT ride_id FROM bookings WHERE id = p_booking_id);
  
  UPDATE bookings
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. **verify_booking_code(booking_id, submitted_code)**
Verifies a booking's verification code.

```sql
CREATE OR REPLACE FUNCTION verify_booking_code(
  booking_id UUID,
  submitted_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  is_valid BOOLEAN;
BEGIN
  SELECT verification_code = submitted_code
  INTO is_valid
  FROM bookings
  WHERE id = booking_id;
  
  IF is_valid THEN
    UPDATE bookings
    SET code_verified = TRUE, verified_at = NOW(), status = 'confirmed'
    WHERE id = booking_id;
  END IF;
  
  RETURN is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. **generate_booking_verification_code(booking_id)**
Generates a 6-digit verification code for a booking.

### 4. **create_receipt(payment_id_param)**
Creates a receipt for a completed payment.

---

## 📦 Storage Buckets

### 1. **driver-documents**
**Purpose**: Store driver verification documents  
**Public**: No  
**Max File Size**: 10MB  
**Allowed Types**: image/*, application/pdf

**Policies:**
- ✅ Upload: Authenticated users only
- ✅ Read: Document owner and admins
- ✅ Update: Document owner only
- ✅ Delete: Document owner and admins

### 2. **avatars**
**Purpose**: Store user profile pictures  
**Public**: Yes  
**Max File Size**: 5MB  
**Allowed Types**: image/*

**Policies:**
- ✅ Upload: Authenticated users only
- ✅ Read: Public
- ✅ Update: Avatar owner only
- ✅ Delete: Avatar owner only

### 3. **vehicle-images**
**Purpose**: Store vehicle photos  
**Public**: Yes (for transparency)  
**Max File Size**: 10MB  
**Allowed Types**: image/*

**Policies:**
- ✅ Upload: Drivers only
- ✅ Read: Public
- ✅ Update: Vehicle owner only
- ✅ Delete: Vehicle owner only

---

## 🔗 Key Relationships

### One-to-Many
- `profiles` → `rides` (One driver, many rides)
- `profiles` → `bookings` (One user, many bookings)
- `rides` → `bookings` (One ride, many bookings)
- `bookings` → `payments` (One booking, many payments)
- `conversations` → `messages` (One conversation, many messages)

### One-to-One
- `profiles` → `driver_documents` (One driver, one document set)
- `payments` → `payment_receipts` (One payment, one receipt)

### Many-to-Many (via junction)
- `profiles` ↔ `profiles` via `conversations` (Users can message each other)

---

## 📈 Performance Optimizations

### Indexes
- ✅ Foreign keys indexed
- ✅ Frequently queried fields indexed
- ✅ Composite indexes for common queries
- ✅ Unique constraints on business keys

### Query Patterns
- ✅ Use `SELECT *` sparingly
- ✅ Paginate large result sets
- ✅ Use joins instead of multiple queries
- ✅ Cache frequently accessed data

---

## 🔄 Migration Strategy

All schema changes are managed via versioned migrations in `supabase/migrations/`:

```
supabase/migrations/
├── 20240126_init.sql
├── 20240126_messaging.sql
├── 20250104_add_driver_application_fields.sql
├── 20250115_add_push_subscriptions.sql
├── 20250221_init_payment_schema.sql
├── 20250221_add_booking_seats_trigger.sql
└── ... (47 total migrations)
```

**Best Practices:**
1. Never modify existing migrations
2. Always create new migration for schema changes
3. Test migrations in staging first
4. Include rollback instructions in comments
5. Keep migrations small and focused

---

## 🔒 Security Considerations

### Authentication
- ✅ Supabase Auth with phone OTP
- ✅ JWT tokens for session management
- ✅ Row Level Security on all tables

### Data Protection
- ✅ Sensitive documents not publicly accessible
- ✅ Payment information encrypted
- ✅ Personal data access restricted

### Audit Trail
- ⚠️ TODO: Implement `payment_audit_log` table
- ⚠️ TODO: Log all admin actions
- ⚠️ TODO: Track document verification changes

---

## 📊 Database Statistics

| Category | Count |
|----------|-------|
| Core Tables | 9 |
| Total Migrations | 47 |
| Storage Buckets | 3 |
| RLS Policies | 35+ |
| Database Triggers | 6 |
| RPC Functions | 4 |

---

## 🔄 Maintenance

### Regular Tasks
- **Daily**: Monitor error logs
- **Weekly**: Review slow queries
- **Monthly**: Analyze table sizes and indexes
- **Quarterly**: Review and optimize RLS policies

### Backup Strategy
- ✅ Automated daily backups (Supabase)
- ✅ Point-in-time recovery available
- ✅ Migration files in version control

---

## 📝 Notes

- All timestamps are in UTC
- Currency amounts use `DECIMAL(10,2)` for precision
- UUIDs used as primary keys for better distribution
- Soft deletes not implemented (using CASCADE)
- Database version: PostgreSQL 15.x (Supabase)

---

**Last Updated**: January 2025  
**Maintained By**: Development Team  
**Schema Version**: 2.1
