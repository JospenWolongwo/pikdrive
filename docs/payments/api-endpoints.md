# API Endpoints Documentation

## Payment Endpoints

### 1. Create Payment
```typescript
POST /api/payments/create
```

#### Request
```typescript
{
  phoneNumber: string;  // Format: 237XXXXXXXXX
  amount: number;       // Range: 100-500000
  bookingId: string;    // UUID
}
```

#### Response
```typescript
{
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  message?: string;
}
```

#### Error Codes
- 400: Invalid request data
- 401: Unauthorized
- 500: Server error

### 2. Check Payment Status
```typescript
GET /api/payments/status
```

#### Query Parameters
```typescript
{
  transactionId: string;
  provider: string;     // Currently only 'mtn'
}
```

#### Response
```typescript
{
  success: boolean;
  status: PaymentStatus;
  message?: string;
}
```

### 3. Background Status Check
```typescript
GET /api/cron/check-pending-payments
```

#### Response
```typescript
{
  checked: number;
  results: Array<{
    paymentId: string;
    status: PaymentStatus;
    error: string | null;
  }>;
}
```

## Webhook Endpoints (Coming Soon)

### 1. MTN MOMO Webhook
```typescript
POST /api/webhooks/mtn-momo
```

#### Headers
```typescript
{
  'X-Signature': string;  // HMAC signature
  'X-Reference': string;  // Transaction ID
}
```

#### Body
```typescript
{
  type: 'payment.success' | 'payment.failed';
  data: {
    transactionId: string;
    status: string;
    financialTransactionId?: string;
    reason?: string;
  };
}
```

## Receipt Endpoints

### 1. Generate Receipt
```typescript
POST /api/receipts/generate
```

#### Request
```typescript
{
  paymentId: string;
}
```

#### Response
```typescript
{
  success: boolean;
  receiptId?: string;
  downloadUrl?: string;
}
```

### 2. Download Receipt
```typescript
GET /api/receipts/[receiptId]
```

#### Response
- PDF file
- Content-Type: application/pdf

## Authentication

All endpoints except webhooks require:
1. Valid session cookie
2. CSRF token
3. User authentication

## Rate Limiting

### Limits
1. Create Payment: 10/minute
2. Status Check: 60/minute
3. Receipt Generation: 30/minute

### Headers
```typescript
{
  'X-RateLimit-Limit': number;
  'X-RateLimit-Remaining': number;
  'X-RateLimit-Reset': number;
}
```

## Error Handling

### Standard Error Response
```typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### Common Error Codes
1. `INVALID_PHONE`: Invalid phone number format
2. `AMOUNT_LIMIT`: Amount outside allowed range
3. `PAYMENT_NOT_FOUND`: Transaction ID not found
4. `PAYMENT_EXPIRED`: Payment timeout
5. `SYSTEM_ERROR`: Internal error

## Testing

### Sandbox Environment
1. Use test credentials
2. Test phone: 237670000000
3. Immediate success flow

### Production Environment
1. Real MTN MOMO accounts
2. Production credentials
3. Actual payment flow

## Monitoring

### Metrics Tracked
1. Request success rate
2. Response time
3. Error frequency
4. Payment completion rate

### Logging
All endpoints log:
1. Request details
2. Response status
3. Error information
4. Performance metrics
