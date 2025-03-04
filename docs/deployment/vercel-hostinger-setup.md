# Connecting Vercel Deployment with Hostinger Domain

## Overview
This guide will help you deploy your Next.js application on Vercel while using your existing Hostinger domain.

## Steps

### 1. Deploy to Vercel

1. **Create Vercel Account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with your GitHub account
   - Import your PikDrive repository

2. **Configure Project**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Login to Vercel
   vercel login

   # Deploy project
   vercel
   ```

3. **Add Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all required variables from your `.env.local`
   - Make sure to add production Supabase credentials

### 2. Configure Hostinger DNS

1. **Log into Hostinger**
   - Go to your Hostinger control panel
   - Navigate to Domains > Your Domain > DNS Zone Editor

2. **Add DNS Records**
   ```
   Type    Name    Value               TTL
   A       @       76.76.21.21        7200
   ```

3. **Add www Subdomain**
   ```
   Type    Name    Value                              TTL
   CNAME   www     cname.vercel-dns.com.             7200
   ```

### 3. Configure Vercel Domain Settings

1. **Add Domain in Vercel**
   - Go to Project Settings > Domains
   - Add your Hostinger domain
   - Wait for DNS verification

2. **SSL/HTTPS Setup**
   - Vercel will automatically provision SSL certificate
   - Verify HTTPS is working
   - Check for any DNS issues

### 4. Verify Setup

1. **Check Domain Propagation**
   - Use [whatsmydns.net](https://www.whatsmydns.net/)
   - Check both A and CNAME records
   - Wait for full propagation (can take up to 48 hours)

2. **Test Your Site**
   - Visit your domain
   - Check HTTPS is working
   - Verify all features are working

### 5. Additional Optimizations

1. **CDN Setup**
   - Vercel includes CDN by default
   - Configure caching in `next.config.js`
   - Set up image optimization

2. **Domain Security**
   - Enable DNSSEC in Hostinger
   - Configure security headers
   - Set up domain monitoring

## Troubleshooting

### Common Issues

1. **DNS Not Propagating**
   - Wait at least 48 hours
   - Verify DNS records are correct
   - Check for conflicting records

2. **SSL Certificate Issues**
   - Remove any existing SSL from Hostinger
   - Let Vercel handle SSL
   - Check for mixed content

3. **Domain Not Working**
   - Verify nameservers are correct
   - Check for DNS conflicts
   - Verify domain ownership

## Support

- Vercel Support: [vercel.com/support](https://vercel.com/support)
- Hostinger Support: Your hosting control panel
- Supabase Support: [supabase.com/support](https://supabase.com/support)

Need help? Feel free to reach out for assistance with the setup process.
