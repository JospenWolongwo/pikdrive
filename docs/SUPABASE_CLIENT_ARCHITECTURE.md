# Supabase Client Architecture Guide

## 🎯 **The Two Supabase Clients**

### **Why Two Clients?**

Next.js applications run in **two environments**:
1. **Browser (Client-Side)** - React components, user interactions
2. **Server (API Routes)** - Backend logic, database operations

Each environment needs a **different** Supabase client configuration.

---

## 📁 **Our Supabase Clients**

### **1. Client-Side: `lib/supabase/client.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(url, anonKey, {
  realtime: {
    params: { eventsPerSecond: 10 }
  }
});
```

**When to Use:**
- ✅ Real-time subscriptions (messages, notifications)
- ✅ Client-side authentication flows
- ✅ Direct database queries from browser (with RLS protection)

**Used In:**
- Zustand stores (for real-time features)
- React components (rare - prefer API routes)
- Client-side hooks

**Example:**
```typescript
// stores/chatStore.ts
import { supabase } from "@/lib/supabase/client";

// Subscribe to real-time messages
const channel = supabase
  .channel(`messages:${rideId}`)
  .on("postgres_changes", { ... }, callback)
  .subscribe();
```

---

### **2. Server-Side: `lib/supabase/server-client.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createApiSupabaseClient(): SupabaseClient {
  const cookieStore = cookies();
  
  return createServerClient(url, anonKey, {
    cookies: {
      get(name) { return cookieStore.get(name)?.value; },
      set(name, value, options) { cookieStore.set({ name, value, ...options }); },
      remove(name, options) { cookieStore.set({ name, value: "", ...options }); }
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "auth-storage"
    }
  });
}
```

**When to Use:**
- ✅ API routes (`/app/api/*`)
- ✅ Server components
- ✅ Server actions
- ✅ Any server-side database operations

**Used In:**
- Server services (`lib/services/server/*`)
- API route handlers
- Middleware

**Example:**
```typescript
// app/api/bookings/route.ts
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerBookingService } from '@/lib/services/server/booking-service';

export async function POST(request: NextRequest) {
  const supabase = createApiSupabaseClient();
  const bookingService = new ServerBookingService(supabase);
  
  const booking = await bookingService.createBooking(params);
  return NextResponse.json({ success: true, data: booking });
}
```

---

## 🏗️ **Enterprise Architecture Pattern**

### **Complete Data Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  React Component                                             │
│    │                                                         │
│    ├─> Zustand Store                                        │
│    │     │                                                   │
│    │     ├─> API Client (HTTP)  ──────┐                    │
│    │     │   (lib/api-client/*)        │                    │
│    │     │                              │                    │
│    │     └─> Supabase Client           │                    │
│    │         (lib/supabase/client.ts)  │                    │
│    │         [Real-time only]           │                    │
│    │                                    │                    │
└────┼────────────────────────────────────┼────────────────────┘
     │                                    │
     │ HTTP Request                       │ WebSocket
     │                                    │
┌────┼────────────────────────────────────┼────────────────────┐
│    │              SERVER                │                    │
├────┼────────────────────────────────────┼────────────────────┤
│    │                                    │                    │
│    ▼                                    │                    │
│  API Route Handler                      │                    │
│    │                                    │                    │
│    ├─> createApiSupabaseClient()       │                    │
│    │     │                              │                    │
│    │     └─> Server Service             │                    │
│    │         (lib/services/server/*)    │                    │
│    │           │                         │                    │
│    │           └─> Direct DB Queries    │                    │
│    │                 │                   │                    │
│    │                 ▼                   ▼                    │
│    │           ┌─────────────────────────────┐              │
│    │           │   PostgreSQL Database       │              │
│    │           │   (with RLS policies)       │              │
│    │           └─────────────────────────────┘              │
│    │                                                         │
└────┼─────────────────────────────────────────────────────────┘
     │
     └─> HTTP Response
```

---

## ✅ **Correct Usage Checklist**

### **Client-Side Code:**

```typescript
// ✅ CORRECT: Real-time subscriptions
import { supabase } from "@/lib/supabase/client";
const channel = supabase.channel('messages').subscribe();

// ✅ CORRECT: API calls via HTTP
import { bookingApiClient } from "@/lib/api-client/booking";
const booking = await bookingApiClient.createBooking(params);

// ❌ WRONG: Direct DB queries from client (unless protected by RLS)
import { supabase } from "@/lib/supabase/client";
const { data } = await supabase.from('bookings').insert(params); // Bypass API!
```

### **Server-Side Code:**

```typescript
// ✅ CORRECT: API route using server client
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
const supabase = createApiSupabaseClient();
const service = new ServerBookingService(supabase);

// ❌ WRONG: API route using browser client
import { supabase } from "@/lib/supabase/client"; // This won't work on server!

// ❌ WRONG: API route making HTTP calls to itself
import { bookingApiClient } from "@/lib/api-client/booking";
const booking = await bookingApiClient.createBooking(params); // Infinite loop!
```

---

## 🎓 **Key Principles**

### **1. Separation of Concerns**
- **Browser**: HTTP calls + Real-time subscriptions
- **Server**: Direct database access

### **2. Cookie Management**
- **Browser**: Automatic cookie handling by browser
- **Server**: Manual cookie handling via Next.js `cookies()`

### **3. Authentication**
- **Browser**: Session stored in cookies, managed by Supabase
- **Server**: Session read from cookies, validated on each request

### **4. Real-Time**
- **Browser**: WebSocket connections for real-time features
- **Server**: No real-time (use HTTP responses)

---

## 🚀 **Best Practices**

### **1. Always Use Server Services in API Routes**

```typescript
// ✅ GOOD
export async function POST(request: NextRequest) {
  const supabase = createApiSupabaseClient();
  const service = new ServerBookingService(supabase);
  return service.createBooking(params);
}

// ❌ BAD
export async function POST(request: NextRequest) {
  const supabase = createApiSupabaseClient();
  // Raw queries scattered everywhere - hard to maintain
  const { data } = await supabase.from('bookings').insert(params);
}
```

### **2. Never Mix Client and Server Supabase**

```typescript
// ❌ NEVER DO THIS
import { supabase } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  // This will fail! Browser client doesn't work on server
  const { data } = await supabase.from('bookings').insert(params);
}
```

### **3. Use Real-Time Only Where Needed**

```typescript
// ✅ GOOD: Real-time for chat messages
const channel = supabase.channel('messages').subscribe();

// ❌ BAD: Real-time for data that rarely changes
const channel = supabase.channel('user-profile').subscribe(); // Overkill!
```

---

## 📊 **When to Use What**

| Scenario | Use This |
|----------|----------|
| API route needs DB access | `createApiSupabaseClient()` |
| React component needs data | `apiClient` (HTTP to API route) |
| Real-time chat/notifications | `supabase` from `client.ts` |
| Server component needs data | `createApiSupabaseClient()` |
| Middleware needs auth | `createApiSupabaseClient()` |
| Store needs to fetch data | `apiClient` (HTTP) |
| Store needs real-time updates | `supabase` from `client.ts` |

---

## 🎯 **Summary**

**Two clients, two purposes:**

1. **`client.ts`** = Browser → Real-time + Client-side auth
2. **`server-client.ts`** = Server → API routes + Server-side auth

**Golden Rule:**
> If it runs in the browser, use `client.ts` for real-time.  
> If it runs on the server, use `server-client.ts` for everything.  
> For data fetching, always prefer HTTP (API routes) over direct DB access.

This separation ensures:
- ✅ Security (RLS + API validation)
- ✅ Performance (server-side queries are faster)
- ✅ Maintainability (centralized business logic)
- ✅ Scalability (can add caching, rate limiting, etc.)
