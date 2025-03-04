# Post-Deployment Checklist

## 1. Security Updates
- [ ] Rotate Supabase keys
- [ ] Update Twilio webhook URLs
- [ ] Update MTN MoMo callback URLs
- [ ] Set up proper CORS policies in Supabase

## 2. Domain Setup
- [ ] Add custom domain in Vercel
- [ ] Update DNS records in Hostinger
- [ ] Verify SSL certificate
- [ ] Update environment variables with new domain

## 3. Testing Critical Features
- [ ] User authentication
- [ ] File uploads
- [ ] Real-time updates
- [ ] PWA installation
- [ ] Offline functionality
- [ ] Payment processing
- [ ] SMS notifications

## 4. Performance Verification
- [ ] Run Lighthouse audit
- [ ] Check Core Web Vitals
- [ ] Verify PWA score
- [ ] Test loading times

## 5. Update Production Environment Variables
```env
# Update these after domain setup
NEXT_PUBLIC_SITE_URL=https://your-domain.com
MOMO_CALLBACK_HOST=https://your-domain.com
```

## 6. Monitoring Setup
- [ ] Set up error tracking
- [ ] Configure performance monitoring
- [ ] Set up uptime monitoring
- [ ] Enable Vercel Analytics

## 7. Backup Configuration
- [ ] Set up Supabase backups
- [ ] Configure database backup schedule
- [ ] Verify backup restoration process

## 8. Documentation Updates
- [ ] Update API documentation
- [ ] Update deployment guides
- [ ] Document monitoring procedures
- [ ] Create incident response plan

## 9. Legal & Compliance
- [ ] Verify privacy policy
- [ ] Check terms of service
- [ ] Ensure GDPR compliance
- [ ] Review security policies

## 10. User Communication
- [ ] Prepare launch announcement
- [ ] Update support documentation
- [ ] Set up feedback channels
- [ ] Configure error pages
