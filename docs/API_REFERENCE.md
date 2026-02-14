# PikDrive API Reference

> Complete reference for all REST API endpoints.
> Base URL: `https://pikdrive.com/api` (production) | `http://localhost:3000/api` (local)

---

## Table of Contents

- [Authentication](#authentication)
- [Rides](#rides)
- [Bookings](#bookings)
- [Booking Verification](#booking-verification)
- [Payments](#payments)
- [Payouts](#payouts)
- [Reviews](#reviews)
- [Messages & Conversations](#messages--conversations)
- [Drivers](#drivers)
- [Passengers](#passengers)
- [Pickup Points](#pickup-points)
- [Notifications](#notifications)
- [Legal](#legal)
- [Admin](#admin)
- [Cron Jobs](#cron-jobs)
- [Webhooks & Callbacks](#webhooks--callbacks)
- [Utility](#utility)

---

## Authentication

Most endpoints require a valid Supabase session cookie. The cookie is set automatically after login via Supabase Auth.

| Symbol | Meaning |
|--------|---------|
| 🔓 | Public — no auth required |
| 🔒 | Auth required — valid session cookie |
| 🔑 | Admin — session + `role = 'admin'` |
| ⚙️ | System — CRON_SECRET or webhook signature |

Common error responses for protected routes:

```json
{ "error": "Unauthorized" }          // 401 — no session
{ "error": "Forbidden" }             // 403 — insufficient role
```

---

## Rides

### `GET /api/rides` 🔓

Search and list available rides with optional filters.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `driver_id` | string | — | Filter by driver |
| `from_city` | string | — | Departure city |
| `to_city` | string | — | Destination city |
| `min_price` | number | — | Minimum price |
| `max_price` | number | — | Maximum price |
| `min_seats` | number | — | Minimum available seats |
| `upcoming` | boolean | — | Only future rides |
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Results per page |

**Response** `200`

```json
{
  "success": true,
  "data": [ /* ride objects */ ],
  "pagination": { "page": 1, "limit": 10, "total": 42 }
}
```

---

### `POST /api/rides` 🔒

Create a new ride. Caller must be an approved driver.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from_city` | string | Yes | Departure city |
| `to_city` | string | Yes | Destination city |
| `departure_time` | string (ISO) | Yes | Departure date/time |
| `price` | number | Yes | Price per seat (XAF) |
| `seats_available` | number | Yes | Total seats offered |
| `description` | string | No | Ride description |
| `car_model` | string | No | Vehicle model |
| `car_color` | string | No | Vehicle color |
| `pickup_points` | string[] | No | Pickup point IDs |

**Response** `200`

```json
{ "success": true, "data": { /* ride object */ } }
```

---

### `GET /api/rides/[id]` 🔒

Get a single ride by ID.

**Response** `200`

```json
{ "success": true, "data": { /* ride with driver profile */ } }
```

---

### `PUT /api/rides/[id]` 🔒

Update a ride. Only the ride owner (driver) can update.

**Request Body** — Same fields as `POST /api/rides`, all optional.

**Response** `200`

```json
{ "success": true, "data": { /* updated ride */ } }
```

---

### `DELETE /api/rides/[id]` 🔒

Delete a ride. Only the ride owner (driver) can delete.

**Response** `200`

```json
{ "success": true, "message": "Ride deleted successfully" }
```

---

### `GET /api/rides/driver` 🔒

Get rides for the authenticated driver.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `upcoming` | boolean | Only future rides |
| `past` | boolean | Only past rides |

**Response** `200`

```json
{ "success": true, "data": [ /* driver's rides */ ] }
```

**Errors**: `403` if caller is not a driver.

---

### `GET /api/rides/user/[userId]` 🔒

Get rides where the user is a driver or passenger. Caller must match `userId`.

**Response** `200`

```json
{ "success": true, "data": [ /* user's rides */ ] }
```

**Errors**: `403` if caller does not match `userId`.

---

## Bookings

### `GET /api/bookings` 🔒

List bookings by user or driver.

**Query Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | One of | Filter by passenger |
| `driverId` | string | One of | Filter by driver |
| `status` | string | No | Filter by booking status |

**Response** `200`

```json
{ "success": true, "data": [ /* booking objects with ride info */ ] }
```

---

### `POST /api/bookings` 🔒

Create a new booking.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ride_id` | string | Yes | Ride to book |
| `seats` | number | Yes | Number of seats |
| `selected_pickup_point_id` | string | No | Preferred pickup point |

**Response** `200`

```json
{ "success": true, "data": { /* booking object */ } }
```

**Errors**: `400` if ride is full, user already booked, or invalid data.

---

### `GET /api/bookings/[id]` 🔒

Get a single booking by ID.

**Response** `200`

```json
{ "success": true, "data": { /* booking with ride info */ } }
```

---

### `PUT /api/bookings/[id]` 🔒

Update booking fields.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Booking status |
| `payment_status` | string | No | Payment status |
| `code_verified` | boolean | No | Verification flag |
| `seats` | number | No | Updated seat count |

**Response** `200`

```json
{ "success": true, "data": { /* updated booking */ } }
```

---

### `DELETE /api/bookings/[id]` 🔒

Cancel a booking. Triggers automatic refund if payment was completed.

**Response** `200`

```json
{
  "success": true,
  "message": "Booking cancelled",
  "refundInitiated": true,
  "refundAmount": 5000,
  "refundRecordId": "uuid"
}
```

---

### `POST /api/bookings/[id]/reduce-seats` 🔒

Reduce seats on an existing booking. Triggers partial refund for removed seats.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `newSeats` | number | No | Target seat count (defaults to current - 1) |

**Response** `200`

```json
{
  "success": true,
  "message": "Seats reduced",
  "refundInitiated": true,
  "refundAmount": 5000,
  "newSeats": 1,
  "seatsRemoved": 2
}
```

---

### `GET /api/bookings/existing` 🔒

Check if a user already has a booking on a ride.

**Query Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `rideId` | string | Yes | Ride ID |
| `userId` | string | Yes | User ID |

**Response** `200`

```json
{ "success": true, "data": { /* existing booking or null */ } }
```

---

## Booking Verification

### `GET /api/bookings/verification-code` 🔒

Get the current verification code for a booking.

**Query Parameters**

| Param | Type | Required |
|-------|------|----------|
| `bookingId` | string | Yes |

**Response** `200`

```json
{
  "success": true,
  "verificationCode": "123456",
  "codeVerified": false,
  "codeExpiry": "2026-02-14T10:00:00Z"
}
```

---

### `POST /api/bookings/generate-code` 🔒

Generate a new verification code for a booking.

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `bookingId` | string | Yes |

**Response** `200`

```json
{ "success": true, "verificationCode": "654321" }
```

---

### `POST /api/bookings/refresh-verification` 🔒

Regenerate an expired verification code.

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `bookingId` | string | Yes |

**Response** `200`

```json
{
  "success": true,
  "verificationCode": "789012",
  "expiryTime": "2026-02-14T12:00:00Z"
}
```

---

### `POST /api/bookings/code-generator` 🔒

Backup code generation endpoint (uses RPC).

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `bookingId` | string | Yes |

**Response** `200`

```json
{ "success": true, "verificationCode": "345678", "message": "Code generated" }
```

---

### `POST /api/bookings/verify-code` 🔒

Driver verifies a passenger's booking code. Triggers payout on success.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bookingId` | string | Yes | Booking to verify |
| `verificationCode` | string | Yes | Code from passenger |

**Response** `200`

```json
{
  "success": true,
  "message": "Code verified",
  "payoutInitiated": true,
  "driverEarnings": 4500,
  "paymentCount": 1
}
```

---

## Payments

### `POST /api/payments/create` 🔒

Initiate a mobile money payment for a booking.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bookingId` | string | Yes | Booking ID |
| `amount` | number | Yes | Amount in XAF |
| `provider` | string | Yes | `mtn` \| `orange` \| `pawapay` |
| `phoneNumber` | string | Yes | Payer phone number |
| `idempotencyKey` | string | Yes | Unique key to prevent duplicates |

**Response** `200`

```json
{ "success": true, "data": { "paymentId": "uuid", "transactionId": "ext-id", "status": "pending" } }
```

---

### `POST /api/payments/check-status` 🔒

Check the current status of a payment with the provider.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionId` | string | Yes | Provider transaction ID |
| `provider` | string | Yes | `mtn` \| `orange` \| `pawapay` |
| `bookingId` | string | No | Booking ID for orchestration |

**Response** `200`

```json
{ "success": true, "data": { "status": "completed", "providerStatus": "SUCCESSFUL" } }
```

---

### `POST /api/payment/payin` 🔒

Generic pay-in endpoint to collect money from a phone number.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phoneNumber` | string | Yes | Payer phone |
| `amount` | number | Yes | Amount in XAF |
| `reason` | string | Yes | Payment reason |

**Response** `200`

```json
{ "success": true, "data": { /* payment result */ } }
```

---

### `POST /api/payment/payout` 🔒

Initiate a payout to a phone number (driver earnings, refunds).

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phoneNumber` | string | Yes | Recipient phone |
| `amount` | number | Yes | Amount in XAF |
| `reason` | string | Yes | Payout reason |
| `currency` | string | Yes | Currency code |
| `customerName` | string | No | Recipient name |
| `userId` | string | No | Defaults to session user |

**Response** `200`

```json
{ "success": true, "data": { /* payout result */ } }
```

---

### `POST /api/payment/verify` 🔒

Verify a payment using a pay token.

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `payToken` | string | Yes |
| `phoneNumber` | string | Yes |

**Response** `200`

```json
{ "success": true, "data": { /* verification result */ } }
```

---

## Payouts

### `POST /api/payouts/check-status` 🔒

Check payout status with the provider. Enforces ownership for non-admins.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionId` | string | One of | Provider transaction ID |
| `payoutId` | string | One of | Internal payout ID |

**Response** `200`

```json
{ "success": true, "data": { "status": "completed", "amount": 4500 } }
```

**Errors**: `403` if payout does not belong to the caller, `404` if not found.

---

### `GET /api/driver/payouts` 🔒

Get payout history and statistics for the authenticated driver.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | — | `pending` \| `processing` \| `completed` \| `failed` |
| `limit` | number | 50 | Results per page |
| `offset` | number | 0 | Pagination offset |

**Response** `200`

```json
{
  "success": true,
  "data": {
    "payouts": [ /* payout objects */ ],
    "statistics": {
      "totalEarnings": 150000,
      "pendingAmount": 5000,
      "completedCount": 30
    },
    "pagination": { "limit": 50, "offset": 0, "total": 35 }
  }
}
```

---

## Reviews

### `POST /api/reviews` 🔒

Submit a review for a completed booking.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `booking_id` | string | Yes | Booking ID |
| `rating` | number | Yes | 1–5 star rating |
| `comment` | string | No | Review text |
| `tags` | string[] | No | Predefined tags (e.g. `punctual`, `clean_car`) |

**Response** `200`

```json
{ "success": true, "data": { /* review object */ } }
```

**Errors**: `400` if user already reviewed or booking is ineligible.

---

### `GET /api/reviews` 🔓

Fetch reviews for a user.

**Query Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `reviewee_id` | string | Yes | User being reviewed |
| `limit` | number | No | Results per page |
| `offset` | number | No | Pagination offset |
| `rating` | number | No | Filter by star rating |

**Response** `200`

```json
{ "success": true, "data": [ /* review objects with reviewer profile */ ] }
```

---

### `GET /api/reviews/user/[userId]` 🔓

Fetch reviews and optional statistics for a specific user.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | — | Results per page |
| `offset` | number | — | Pagination offset |
| `include_stats` | boolean | false | Include rating distribution |

**Response** `200`

```json
{
  "success": true,
  "data": {
    "reviews": [ /* review objects */ ],
    "statistics": { "average": 4.7, "total": 23, "distribution": { "5": 18, "4": 3, "3": 2 } }
  }
}
```

---

### `GET /api/reviews/check-eligibility/[bookingId]` 🔒

Check if the authenticated user can submit a review for a booking.

**Response** `200`

```json
{
  "success": true,
  "data": {
    "eligible": true,
    "reason": null,
    "reviewerType": "passenger",
    "revieweeId": "driver-uuid"
  }
}
```

---

## Messages & Conversations

### `POST /api/conversations` 🔒

Get or create a conversation for a ride between driver and passenger.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ride_id` | string | Yes | Ride ID |
| `driver_id` | string | Yes | Driver user ID |
| `passenger_id` | string | Yes | Passenger user ID |

**Errors**: `403` if caller is neither the driver nor the passenger.

**Response** `200`

```json
{ "success": true, "data": { /* conversation object */ } }
```

---

### `GET /api/conversations/user/[userId]` 🔒

Fetch all conversations for a user. Caller must match `userId`.

**Response** `200`

```json
{ "success": true, "data": [ /* conversations with ride and participant info */ ] }
```

---

### `POST /api/messages` 🔒

Send a message in a conversation.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conversation_id` | string | One of | Existing conversation |
| `ride_id` | string | One of | Creates conversation if needed |
| `content` | string | Yes | Message text |

**Response** `200`

```json
{ "success": true, "data": { /* message object */ } }
```

---

### `GET /api/messages/ride/[rideId]` 🔒

Get or create conversation for a ride and return all messages.

**Response** `200`

```json
{ "success": true, "data": { "conversation": { /* ... */ }, "messages": [ /* ... */ ] } }
```

---

### `POST /api/messages/read/[rideId]` 🔒

Mark messages as read for a ride conversation.

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `userId` | string | Yes |

**Errors**: `403` if caller does not match `userId`.

**Response** `200`

```json
{ "success": true }
```

---

### `GET /api/messages/unread/[userId]` 🔒

Get unread message counts grouped by conversation. Caller must match `userId`.

**Response** `200`

```json
{ "success": true, "data": { "conversation-id-1": 3, "conversation-id-2": 1 } }
```

---

## Drivers

### `GET /api/drivers/[id]` 🔓

Get a public driver profile. Only returns approved drivers.

**Response** `200`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "full_name": "Jean Dupont",
    "avatar_url": "...",
    "average_rating": 4.7,
    "total_reviews": 23,
    "vehicle_info": { /* ... */ }
  }
}
```

**Errors**: `404` if driver not found or not approved.

---

### `GET /api/driver/reservations` 🔒

Get all rides and their bookings for the authenticated driver.

**Errors**: `403` if caller is not a driver.

**Response** `200`

```json
{ "success": true, "data": [ /* rides with nested bookings */ ] }
```

---

## Passengers

### `GET /api/passengers/check-info` 🔒

Check if a passenger's profile info is complete. Caller must match `userId`.

**Query Parameters**

| Param | Type | Required |
|-------|------|----------|
| `userId` | string | Yes |

**Response** `200`

```json
{ "success": true, "data": { "complete": true, "missing": [] } }
```

---

## Pickup Points

### `GET /api/pickup-points` 🔓

Get pickup points for a city.

**Query Parameters**

| Param | Type | Required |
|-------|------|----------|
| `city` | string | Yes |

**Response** `200`

```json
{ "success": true, "data": [ { "id": "uuid", "name": "Carrefour Deido", "city": "Douala" } ] }
```

---

## Notifications

### `POST /api/notifications/booking` 🔒

Send a booking-related push notification.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notificationData` | object | Yes | `{ title, message, type, data }` |

**Response** `200`

```json
{ "success": true }
```

---

### `GET /api/notifications/booking` 🔒

Health check for the notification service.

**Response** `200`

```json
{ "success": true, "message": "Notification service is running" }
```

---

## Legal

### `POST /api/legal/consent` 🔒

Record user consent for terms or privacy policy. Uses Bearer token auth.

**Headers**: `Authorization: Bearer <token>`

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `consentType` | string | Yes | `terms_and_privacy` \| `driver_terms` |
| `termsVersion` | string | Yes | Version string |

**Response** `200`

```json
{ "success": true }
```

---

### `GET /api/legal/consent` 🔒

Get consent history for the authenticated user. Uses Bearer token auth.

**Headers**: `Authorization: Bearer <token>`

**Response** `200`

```json
{ "success": true, "data": [ { "consentType": "terms_and_privacy", "termsVersion": "1.0", "created_at": "..." } ] }
```

---

## Admin

All admin endpoints require session + `role = 'admin'` on the profile.

### `PATCH /api/admin/drivers/[id]/status` 🔑

Update a driver's application status.

**Request Body**

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `status` | string | Yes | `approved` \| `rejected` \| `inactive` |

**Response** `200`

```json
{ "success": true, "data": { /* updated driver profile */ } }
```

---

### `GET /api/admin/passengers` 🔑

List all passengers with their documents and profile data.

**Response** `200`

```json
{ "success": true, "data": [ /* passenger profiles */ ] }
```

---

### `GET /api/admin/pickup-points` 🔑

List all pickup points, optionally filtered by city.

**Query Parameters**

| Param | Type | Required |
|-------|------|----------|
| `city` | string | No |

**Response** `200`

```json
{ "success": true, "data": [ /* pickup points */ ] }
```

---

### `POST /api/admin/pickup-points` 🔑

Create a new pickup point.

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `city` | string | Yes |
| `name` | string | Yes |
| `display_order` | number | Yes |

**Response** `200`

```json
{ "success": true, "data": { /* new pickup point */ } }
```

---

### `PATCH /api/admin/pickup-points/[id]` 🔑

Update a pickup point.

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | No |
| `display_order` | number | No |

**Response** `200`

```json
{ "success": true, "data": { /* updated pickup point */ } }
```

---

### `DELETE /api/admin/pickup-points/[id]` 🔑

Delete a pickup point.

**Response** `200`

```json
{ "success": true, "message": "Pickup point deleted" }
```

---

### `POST /api/admin/driver-applications/notify`

Trigger admin notification for a new driver application.

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `driverId` | string | No |
| `submittedAt` | string | No |

**Response** `200`

```json
{ "success": true, "notified": true }
```

---

## Cron Jobs

Scheduled endpoints triggered by Vercel Cron. Configured in `vercel.json`.

### `GET /api/cron/check-pending-payments` ⚙️

Reconciles stale/pending payments with providers. Runs daily at 3:00 AM UTC.

**Response** `200`

```json
{ "success": true, "data": { "processed": 5, "updated": 3 } }
```

---

### `GET /api/cron/send-review-requests` ⚙️

Sends review request notifications (WhatsApp + push) for eligible bookings. Runs daily at 8:00 PM UTC.

**Response** `200`

```json
{
  "success": true,
  "data": {
    "passengerRequestsSent": 12,
    "driverRequestsSent": 8,
    "totalSent": 20,
    "errors": []
  },
  "timestamp": "2026-02-14T20:00:00Z"
}
```

---

## Webhooks & Callbacks

External provider endpoints. No user auth — secured by signatures or always-200 pattern.

### `POST /api/payments/callback`

Generic payment callback for MTN/Orange. Always returns `200` to prevent retries.

**Request Body**: Provider-specific payload with `referenceId`/`externalId` and `status`.

---

### `POST /api/payments/orange/callback`

Orange Money payment callback. Always returns `200`.

**Request Body**: `{ status, transactionId, externalId, message, failureReason }`

---

### `POST /api/callbacks/pawapay`

PawaPay deposit and payout callback. Always returns `200`.

**Request Body**: PawaPay webhook payload (delegated to `ServerPawaPayCallbackService`).

---

### `POST /api/callbacks/om`

Orange Money pay-in and payout callback. Always returns `200`.

**Request Body**: Orange Money callback payload (delegated to `ServerOrangeMoneyCallbackService`).

---

### `POST /api/callbacks/momo`

MTN MoMo payment (pay-in) callback. Always returns `200`.

**Request Body**: `{ financialTransactionId, externalId, amount, currency, payer, status, reason }`

---

### `POST /api/callbacks/momo-payout`

MTN MoMo payout callback. Always returns `200`.

**Request Body**: `{ financialTransactionId, externalId, amount, currency, payee, status, reason }`

---

### `POST /api/callbacks/refund`

Refund status callback from MTN/Orange/PawaPay.

**Request Body**: `{ transaction_id, status, externalId }`

**Response**: `200` on success, `404` if refund not found.

---

### `GET /api/webhooks/whatsapp`

WhatsApp webhook verification (Meta handshake).

**Query Parameters**: `hub.mode`, `hub.challenge`, `hub.verify_token`

**Response**: `200` with `hub.challenge` value on success.

---

### `POST /api/webhooks/whatsapp`

WhatsApp incoming messages and status updates. Verified via `X-Hub-Signature-256` HMAC.

**Response**: `200` (always acknowledged).

---

### `POST /api/webhooks/mtn-momo`

MTN MoMo payment webhook. Verified via `X-Signature` HMAC.

**Request Body**: `{ type: 'payment.success' | 'payment.failed', data: { ... } }`

**Response**: `200` on success, `401` on invalid signature.

---

### `POST /api/webhooks/onesignal`

OneSignal event webhook. No signature verification.

**Response**: `200` (always acknowledged).

---

## Utility

### `POST /api/auth/clear-cookies`

Clears stale Supabase auth cookies when project URL changes.

**Response** `200`

```json
{ "success": true, "cleared": true }
```

---

### `POST /api/storage/bucket-check`

Checks if a Supabase storage bucket exists and creates it if needed.

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `bucketId` | string | Yes |

**Response** `200`

```json
{ "success": true, "created": false, "bucketId": "avatars" }
```

---

## Error Format

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request / validation error |
| 401 | Unauthorized — no valid session |
| 403 | Forbidden — insufficient permissions |
| 404 | Resource not found |
| 500 | Internal server error |

---

**Last Updated**: February 2026
