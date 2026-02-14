# PikDrive Documentation Index

## Quick Navigation

---

## Architecture & Design

### Core Architecture
- **[Architecture Best Practices](ARCHITECTURE_BEST_PRACTICES.md)** - Service layer patterns and principles
- **[Supabase Client Architecture](SUPABASE_CLIENT_ARCHITECTURE.md)** - Client/server separation patterns
- **[Service Layer Complete](SERVICE_LAYER_COMPLETE.md)** - Service layer implementation guide
- **[Database Schema](DATABASE_SCHEMA.md)** - Complete database schema, tables, RLS policies

---

## Payment System

### Overview & Status
- **[Payment Implementation Complete](PAYMENT_IMPLEMENTATION_COMPLETE.md)** - Current architecture and status
- **[Payment Architecture Analysis](PAYMENT_ARCHITECTURE_ANALYSIS.md)** - Comprehensive payment module analysis
- **[Payment Red Flags & Fixes](PAYMENT_RED_FLAGS_AND_FIXES.md)** - Historical issues and resolutions

### Guides
- **[Payment Flow](payments/payment-flow.md)** - End-to-end payin, payout, and refund flows
- **[Payment Status Management](payments/status-management.md)** - Status transitions including partial_refund
- **[API Endpoints](payments/api-endpoints.md)** - Payment API reference
- **[Environment Variables](payments/ENVIRONMENT_VARIABLES.md)** - Payment env var reference

### Provider Integration
- **[MTN MOMO Integration](payments/mtn-momo-integration.md)** - MTN Mobile Money setup
- **[Orange Money Setup Guide](payments/orange-money-setup-guide.md)** - Orange Money integration guide
- **[Sandbox Testing Checklist](payments/SANDBOX_TESTING_CHECKLIST.md)** - Testing guide
- **[Sandbox to Production Guide](payments/SANDBOX_TO_PRODUCTION_GUIDE.md)** - Go-live checklist

### Deployment
- **[Payment Deployment Guide](payments/deployment-guide.md)** - Production deployment checklist
- **[Payments README](payments/README.md)** - Payment module overview

---

## Notifications

### Multi-Channel System
- **[Notification System Overview](NOTIFICATION_SYSTEM_OVERVIEW.md)** - Architecture: OneSignal + WhatsApp + Browser
- **[Notification Templates](NOTIFICATION_TEMPLATES.md)** - Notification content templates
- **[Notification Sounds Guide](NOTIFICATION_SOUNDS_GUIDE.md)** - Sound configuration

### WhatsApp
- **[WhatsApp Implementation Summary](WHATSAPP_IMPLEMENTATION_SUMMARY.md)** - WhatsApp integration details
- **[WhatsApp Webhook Setup](WHATSAPP_WEBHOOK_SETUP.md)** - Webhook configuration

### OneSignal
- **[OneSignal Setup Guide](ONESIGNAL_SETUP_GUIDE.md)** - Initial setup
- **[OneSignal Integration Complete](ONESIGNAL_INTEGRATION_COMPLETE.md)** - Integration status

### Reference
- **[SMS Removal Summary](SMS_REMOVAL_SUMMARY.md)** - Why SMS was removed
- **[Notifications Troubleshooting](notifications/TROUBLESHOOTING.md)** - Common issues and solutions

---

## Review System

- **[Database Schema](DATABASE_SCHEMA.md)** - `reviews` table definition
- Review API: `app/api/reviews/` (create, fetch, check eligibility)
- Review UI: `components/reviews/` (ReviewCard, ReviewList, RatingSummary)
- Review Requests: `lib/services/server/review-request-service.ts` (cron-triggered)
- Types: `types/review.ts`

---

## Deployment

- **[Deployment Guide](deployment/deployment-guide.md)** - Complete deployment instructions
- **[Vercel + Hostinger Setup](deployment/vercel-hostinger-setup.md)** - Hosting configuration
- **[Post-Deployment Checklist](deployment/post-deployment-checklist.md)** - Verification steps

---

## Development

### Getting Started
- **[Environment Setup](environment-setup.md)** - Local development setup
- **[Database Schema](DATABASE_SCHEMA.md)** - Database structure reference

### Testing
- **[Test Feedback Improvement Plan](testing/test-feedback-improvement-plan.md)** - Testing strategy
- **[Reservation Payment Flow](testing/reservation-payment-flow.md)** - End-to-end flow testing

---

## Historical / Reference

- **[Payment Refactoring Summary](PAYMENT_REFACTORING_SUMMARY.md)** - Payment module refactoring history
- **[Booking Payment Bug Fix](BOOKING_PAYMENT_BUG_FIX.md)** - Booking payment fix details
- **[Authentication Stability Fixes](AUTHENTICATION_STABILITY_FIXES.md)** - Auth fixes
- **[Cleanup Complete Summary](CLEANUP_COMPLETE_SUMMARY.md)** - Repository cleanup history

---

## Quick Reference

**Setting up development:** [Environment Setup](environment-setup.md) -> [Database Schema](DATABASE_SCHEMA.md)

**Adding a feature:** [Architecture Best Practices](ARCHITECTURE_BEST_PRACTICES.md) -> [Service Layer](SERVICE_LAYER_COMPLETE.md)

**Deploying:** [Deployment Guide](deployment/deployment-guide.md) -> [Post-Deployment Checklist](deployment/post-deployment-checklist.md)

**Troubleshooting payments:** [Payment Red Flags](PAYMENT_RED_FLAGS_AND_FIXES.md) -> [Status Management](payments/status-management.md)

---

**Last Updated**: February 2026
