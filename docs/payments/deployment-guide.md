# Deployment Guide

## Environment Variables

### Required Variables
```bash
# MTN MOMO API
MOMO_SUBSCRIPTION_KEY=your_key
MOMO_API_KEY=your_api_key
MOMO_TARGET_ENVIRONMENT=sandbox|production
MOMO_CALLBACK_HOST=your_host
MOMO_COLLECTION_PRIMARY_KEY=your_key
MOMO_COLLECTION_USER_ID=your_user_id

# Webhook Security
MOMO_WEBHOOK_SECRET=your_webhook_secret

# Cron Job Security
CRON_SECRET=your_cron_secret
```

## Webhook Setup

### 1. Generate Webhook Secret
```bash
# Generate a secure random string
openssl rand -hex 32
```

### 2. Configure MTN MOMO Webhook
1. Log into MTN MOMO developer portal
2. Navigate to Webhook settings
3. Set webhook URL: `https://your-domain.com/api/webhooks/mtn-momo`
4. Add webhook secret
5. Enable webhooks

### 3. Test Webhook
```bash
# Using curl
curl -X POST https://your-domain.com/api/webhooks/mtn-momo \
  -H "Content-Type: application/json" \
  -H "X-Signature: your-test-signature" \
  -H "X-Reference: test-transaction-id" \
  -d '{"type":"payment.success","data":{"transactionId":"test-id"}}'
```

## Cron Job Setup

### 1. GitHub Actions Setup
1. Go to repository settings
2. Add these secrets:
   - `APP_URL`: Your application URL
   - `CRON_SECRET`: Random secret for cron authentication

### 2. Enable Workflow
```bash
# Enable GitHub Actions workflow
git add .github/workflows/check-payments.yml
git commit -m "Add payment check workflow"
git push
```

### 3. Test Cron Job
1. Go to Actions tab
2. Find "Check Pending Payments"
3. Click "Run workflow"
4. Check logs for success

## Security Measures

### 1. Webhook Security
- Signature verification
- HTTPS only
- Rate limiting
- IP whitelisting (optional)

### 2. Cron Security
- Secret token authentication
- HTTPS only
- Rate limiting
- Fixed schedule

## Monitoring Setup

### 1. Log Monitoring
```bash
# Set up log alerts for:
- Failed webhook calls
- Invalid signatures
- Cron job failures
- Payment timeouts
```

### 2. Performance Monitoring
```bash
# Monitor:
- Webhook response time
- Cron job execution time
- Database query performance
- API endpoint latency
```

### 3. Error Tracking
```bash
# Track:
- Webhook processing errors
- Payment status check failures
- Database transaction errors
- API request failures
```

## Backup Procedures

### 1. Database Backups
```bash
# Regular backups of:
- Payment records
- Transaction logs
- Receipt data
- Webhook logs
```

### 2. Configuration Backups
```bash
# Backup:
- Environment variables
- Webhook configurations
- Cron job settings
- Security certificates
```

## Recovery Procedures

### 1. Webhook Failures
```bash
# If webhooks fail:
1. Check webhook logs
2. Verify signature calculation
3. Test endpoint accessibility
4. Check MTN MOMO status
```

### 2. Cron Job Failures
```bash
# If cron jobs fail:
1. Check GitHub Actions logs
2. Verify environment variables
3. Test endpoint manually
4. Check authentication
```

## Maintenance Tasks

### Daily
```bash
# Check:
1. Webhook health
2. Cron job execution
3. Error logs
4. Payment success rate
```

### Weekly
```bash
# Review:
1. Performance metrics
2. Security logs
3. Failed payments
4. System resources
```

### Monthly
```bash
# Perform:
1. Security audit
2. Performance optimization
3. Configuration review
4. Documentation update
```
