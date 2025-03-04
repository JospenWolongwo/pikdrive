# PikDrive Payment System Documentation

## Overview
PikDrive's payment system integrates MTN Mobile Money (MOMO) for seamless ride payments. This documentation covers the technical implementation, workflows, and maintenance procedures.

## Table of Contents
1. [Architecture](./architecture.md)
2. [Payment Flow](./payment-flow.md)
3. [Database Schema](./database-schema.md)
4. [API Endpoints](./api-endpoints.md)
5. [Status Management](./status-management.md)
6. [Error Handling](./error-handling.md)
7. [Testing Guide](./testing-guide.md)
8. [Deployment Guide](./deployment-guide.md)

## Quick Start
1. Environment Setup
   ```bash
   # Required environment variables
   MOMO_SUBSCRIPTION_KEY=your_key
   MOMO_API_KEY=your_api_key
   MOMO_TARGET_ENVIRONMENT=sandbox|production
   MOMO_CALLBACK_HOST=your_host
   MOMO_COLLECTION_PRIMARY_KEY=your_key
   MOMO_COLLECTION_USER_ID=your_user_id
   ```

2. Test Phone Numbers
   ```
   Sandbox: 237670000000
   ```

3. Status Codes
   ```typescript
   type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';
   ```

## Support
For technical support or bug reports, please contact:
- Email: support@pikdrive.com
- Tech Lead: @jospen
