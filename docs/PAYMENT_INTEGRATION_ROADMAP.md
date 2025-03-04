# PikDrive Payment Integration Roadmap

## Overview
This document outlines the implementation plan for integrating MTN and Orange Money payment systems into PikDrive's booking functionality. The goal is to ensure secure and reliable payment processing before ride confirmation.

## 1. Database Schema Updates

### 1.1 Payments Table
```sql
CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id uuid REFERENCES public.bookings(id),
    amount decimal(10,2) NOT NULL,
    currency varchar(10) DEFAULT 'XAF',
    status varchar(20) DEFAULT 'pending',
    provider varchar(20), -- 'mtn' or 'orange'
    transaction_id varchar(100),
    phone_number varchar(20),
    payment_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
```

### 1.2 Update Bookings Table
```sql
ALTER TABLE public.bookings
ADD COLUMN payment_status varchar(20) DEFAULT 'pending',
ADD COLUMN payment_id uuid REFERENCES public.payments(id);
```

## 2. Payment Integration Components

### 2.1 Payment Gateway Interface
- Create a payment gateway abstraction layer
- Implement provider-specific adapters for MTN and Orange Money
- Handle payment callbacks and webhooks

### 2.2 Mobile Money API Integration
1. MTN Mobile Money
   - Integration with MTN MOMO API
   - Collection API for receiving payments
   - Disbursement API for refunds
   - Sandbox testing environment setup

2. Orange Money
   - Integration with Orange Money API
   - Web Payment API implementation
   - Merchant API for transaction management
   - Test environment configuration

## 3. User Interface Updates

### 3.1 Booking Flow Enhancement
1. Seat Selection
2. Price Calculation
3. Payment Method Selection
   - MTN Mobile Money
   - Orange Money
4. Phone Number Input
5. Payment Confirmation
6. Success/Failure Handling

### 3.2 New Components
```typescript
// Components to be created:
- PaymentMethodSelector
- PhoneNumberInput
- PaymentConfirmation
- PaymentStatus
- TransactionReceipt
```

## 4. Backend Implementation

### 4.1 Payment Processing Service
```typescript
interface PaymentProcessor {
  initiatePayment(booking: Booking, phone: string): Promise<PaymentResponse>;
  verifyPayment(transactionId: string): Promise<PaymentStatus>;
  handleCallback(payload: any): Promise<void>;
  processRefund(payment: Payment): Promise<RefundResponse>;
}
```

### 4.2 API Endpoints
```typescript
// New endpoints to be implemented:
POST /api/payments/initiate
POST /api/payments/verify
POST /api/payments/callback
POST /api/payments/refund
GET  /api/payments/status/:id
```

## 5. Security Measures

### 5.1 Payment Security
- Implement encryption for sensitive data
- Secure API key management
- Request signing and validation
- IP whitelisting for callbacks
- Rate limiting for payment endpoints

### 5.2 Transaction Monitoring
- Real-time transaction monitoring
- Fraud detection mechanisms
- Transaction logging and auditing
- Automated alerts for suspicious activities

## 6. Testing Strategy

### 6.1 Test Cases
1. Payment Flow Testing
   - Successful payment scenarios
   - Failed payment handling
   - Network timeout handling
   - Invalid phone number handling
   - Insufficient balance scenarios

2. Integration Testing
   - API endpoint testing
   - Callback handling
   - Payment status updates
   - Database consistency

3. Security Testing
   - Input validation
   - Authentication checks
   - API security testing
   - Data encryption verification

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
- Database schema updates
- Basic payment interface
- UI components for payment flow

### Phase 2: MTN Integration (Week 2)
- MTN MOMO API integration
- Payment processing implementation
- Testing in sandbox environment

### Phase 3: Orange Money (Week 3)
- Orange Money API integration
- Payment flow completion
- Integration testing

### Phase 4: Security & Polish (Week 4)
- Security measures implementation
- UI/UX refinements
- Performance optimization
- Documentation

## 8. Error Handling

### 8.1 Common Scenarios
```typescript
enum PaymentError {
  INVALID_PHONE = 'invalid_phone',
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
  PROVIDER_ERROR = 'provider_error'
}
```

### 8.2 User Communication
- Clear error messages
- Guided resolution steps
- Support contact information
- Transaction status tracking

## 9. Monitoring and Analytics

### 9.1 Key Metrics
- Transaction success rate
- Payment processing time
- Error frequency by type
- Provider performance
- User payment preferences

### 9.2 Reporting
- Daily transaction summaries
- Error reports
- Financial reconciliation
- Provider performance comparison

## Next Steps
1. Review and approve technical specifications
2. Set up development environment
3. Begin database schema updates
4. Start UI component development
5. Initiate API integration process

## Notes
- All amounts should be in FCFA
- Phone numbers should follow Cameroon format
- Implement proper error handling and user feedback
- Ensure proper transaction logging
- Follow security best practices
- Maintain test coverage throughout development
