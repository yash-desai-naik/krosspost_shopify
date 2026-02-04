# Shopify Compliance Webhooks - Setup & Deployment Guide

## What Was Implemented

Your Shopify app now includes **mandatory compliance webhooks** required for publishing on the Shopify App Store. These webhooks handle GDPR, CPRA, and other privacy law compliance requests.

### Three Compliance Webhooks Added

| Webhook | Endpoint | Purpose |
|---------|----------|---------|
| `customers/data_request` | `/webhooks/shopify/customers/data_request` | Customer requests their stored data |
| `customers/redact` | `/webhooks/shopify/customers/redact` | Customer requests their data be deleted |
| `shop/redact` | `/webhooks/shopify/shop/redact` | Shop owner uninstalls app (triggered 48h later) |

### Key Features

✅ **HMAC Signature Verification** - All webhooks verify the `X-Shopify-Hmac-SHA256` header for security
✅ **Audit Trail** - All requests logged in `compliance_requests` table
✅ **Automatic Data Deletion** - Deletes customer/shop data on redaction requests
✅ **Error Handling** - Returns proper HTTP status codes

---

## Files Created/Modified

### New Files
- **`src/routes/shopify-webhooks.ts`** - All three compliance webhook endpoints with HMAC verification
- **`shopify.app.toml`** - Shopify app configuration file for webhook registration
- **`COMPLIANCE_WEBHOOKS.md`** - Detailed webhook documentation
- **`DEPLOYMENT_CHECKLIST.md`** - This file (setup & deployment guide)

### Modified Files
- **`src/index.ts`** - Added shopify-webhooks router
- **`src/db/schema.sql`** - Added `compliance_requests` table for audit trail

---

## Pre-Deployment Checklist

### 1. Database Migration
Before deploying, run the database migration to add the compliance table:

```bash
npm run db:migrate
```

This creates the `compliance_requests` table with audit trail columns.

### 2. Environment Configuration
Ensure your `.env` file has:

```env
# Required
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
APP_URL=https://your-domain.com

# For Shopify API
SHOPIFY_SCOPES=read_products,read_inventory,write_draft_orders,write_orders,read_customers,write_customers
```

### 3. Build & Test
```bash
# Build TypeScript
npm run build

# Test locally (requires ngrok for tunneling)
npm run dev
```

---

## Local Development Setup

### Step 1: Install Tunneling Service
To test webhooks locally, you need to expose your local server:

```bash
# Using ngrok (recommended)
brew install ngrok    # or download from https://ngrok.com/

# Start tunnel
ngrok http 3000
# Example output: https://abc123.ngrok.io -> http://localhost:3000
```

### Step 2: Update Configuration
Update `shopify.app.toml` with your ngrok URL:

```toml
[[webhooks.subscriptions]]
topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://abc123.ngrok.io/webhooks/shopify/customers/data_request"
```

### Step 3: Register Webhooks with Shopify CLI
```bash
# Install Shopify CLI if not already installed
npm install -g @shopify/cli

# Authenticate
shopify auth login

# Register webhooks
shopify app webhook trigger --topic customers/data_request
shopify app webhook trigger --topic customers/redact  
shopify app webhook trigger --topic shop/redact
```

### Step 4: Start Development Server
```bash
npm run dev
```

You should see output like:
```
✓ Server running on http://localhost:3000
  - Shopify Compliance Webhooks:
    • customers/data_request: http://localhost:3000/webhooks/shopify/customers/data_request
    • customers/redact: http://localhost:3000/webhooks/shopify/customers/redact
    • shop/redact: http://localhost:3000/webhooks/shopify/shop/redact
```

---

## Production Deployment

### Step 1: Update Configuration Files

Update `shopify.app.toml`:
```toml
[[webhooks.subscriptions]]
topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://your-production-domain.com/webhooks/shopify/customers/data_request"
```

### Step 2: SSL/TLS Certificate
Shopify requires HTTPS with a valid SSL certificate:

```bash
# Verify your domain uses HTTPS
curl -I https://your-production-domain.com/webhooks/shopify/customers/data_request
# Should respond with 200 and valid SSL certificate
```

Popular options:
- **AWS Certificate Manager** (if using AWS)
- **Render.com** (includes free SSL with your deployment)
- **Heroku** (includes free SSL)
- **Let's Encrypt** (free certificates)

### Step 3: Deploy Your App

**Option A: Using Render.com**
```bash
# Render automatically deploys from your git repo
# Make sure render.yaml is configured
git push

# Your app will be available at:
# https://krosspost-shopify.onrender.com
```

**Option B: Using Heroku**
```bash
heroku create krosspost-shopify
heroku config:set SHOPIFY_API_KEY=your_key
heroku config:set SHOPIFY_API_SECRET=your_secret
heroku config:set APP_URL=https://krosspost-shopify.herokuapp.com

git push heroku main

# Run migrations
heroku run npm run db:migrate
```

**Option C: Other Platforms**
Follow your platform's deployment guide, ensuring:
- Node.js runtime available
- PostgreSQL database configured
- Environment variables set
- HTTPS enabled

### Step 4: Verify Webhooks in Shopify

After deployment:

1. Go to your Shopify app settings
2. Navigate to "Configuration" → "Webhooks"
3. Verify all three endpoints are registered:
   - ✅ customers/data_request
   - ✅ customers/redact
   - ✅ shop/redact
4. Test webhook delivery:
   ```bash
   shopify app webhook trigger --topic customers/data_request
   ```

### Step 5: Monitor Webhook Activity

```bash
# View webhook logs
npx ts-node -e "
  import { getPool } from './src/db';
  getPool().query('SELECT * FROM compliance_requests ORDER BY created_at DESC LIMIT 10').then(result => {
    console.table(result.rows);
    process.exit(0);
  });
"
```

---

## Shopify App Review Checklist

Before submitting your app for review, verify:

- ✅ App authenticates immediately after install (existing)
- ✅ App redirects to UI after authentication (existing)
- ✅ **App provides mandatory compliance webhooks** (NEW - now complete)
- ✅ **App verifies webhooks with HMAC signatures** (NEW - now complete)
- ✅ App uses valid TLS certificate (existing - HTTPS only)

---

## Testing Your Implementation

### Manual Webhook Testing

#### Test Data Request
```bash
# Manually trigger the webhook
shopify app webhook trigger --topic customers/data_request

# Check logs for:
# ✅ Valid HMAC signature verified
# 📨 Received customers/data_request webhook
# ✅ Data request acknowledged and stored
```

#### Test Customer Redaction
```bash
shopify app webhook trigger --topic customers/redact

# Check logs for:
# ✅ Valid HMAC signature verified
# 📨 Received customers/redact webhook
# ✅ Customer data redacted
```

#### Test Shop Redaction
```bash
shopify app webhook trigger --topic shop/redact

# Check logs for:
# ✅ Valid HMAC signature verified
# 📨 Received shop/redact webhook
# ✅ All shop data deleted
```

### Verify HMAC Validation

The app rejects webhooks without valid HMAC:

```bash
# Test with invalid HMAC header
curl -X POST https://your-app.com/webhooks/shopify/customers/data_request \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-SHA256: invalid-hmac" \
  -d '{"shop_id": 123}'

# Should return 401 Unauthorized
```

---

## Compliance & Legal Requirements

### What This Implements
1. ✅ GDPR Article 15 - Right of access (data_request)
2. ✅ GDPR Article 17 - Right to erasure (redact)
3. ✅ CPRA - Deletion requests (shop/redact)
4. ✅ Audit trail for compliance (compliance_requests table)

### What Still Needs Implementation
In addition to these webhooks, you should:

1. **Privacy Policy**
   - Publish on your website
   - Explain what personal data you collect
   - Explain how Shopify uses it
   - Provide means for data subject requests

2. **Data Retention Policy**
   - Define retention periods
   - Explain legal/business reasons

3. **Consent Management**
   - Ensure proper consent for data collection
   - Document consent records

---

## Troubleshooting

### "Missing X-Shopify-Hmac-SHA256 header" Error
**Cause:** Shopify webhook not including HMAC header
**Solution:** 
- Verify webhooks are registered in Shopify admin
- Restart your app server
- Re-trigger webhook

### "Invalid HMAC signature" Error
**Cause:** HMAC verification failed
**Solution:**
- Verify `SHOPIFY_API_SECRET` matches Shopify app settings
- Ensure raw request body is being captured correctly
- Check that webhook payload wasn't modified

### Webhooks Not Received
**Cause:** Endpoint not accessible or webhook registration issue
**Solution:**
- Verify endpoint is publicly accessible: `curl https://your-domain.com/webhooks/shopify/customers/data_request`
- Check firewall/security groups allow HTTPS traffic
- Re-register webhooks through Shopify CLI
- Check Shopify app logs for errors

### Database Table Not Found
**Cause:** Migration not run
**Solution:**
```bash
npm run db:migrate
```

---

## Support & Resources

- [Shopify Privacy Law Compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Shopify App Requirements Checklist](https://shopify.dev/docs/apps/launch/app-requirements-checklist)
- [Shopify Webhooks Guide](https://shopify.dev/docs/apps/build/webhooks)
- [Detailed Webhook Implementation](./COMPLIANCE_WEBHOOKS.md)

---

## Next Steps

1. ✅ Database migration: `npm run db:migrate`
2. ✅ Local testing with ngrok
3. ✅ Deploy to production
4. ✅ Register webhooks in Shopify admin
5. ✅ Submit app for Shopify App Review

Your app is now compliant with Shopify's mandatory privacy requirements! 🎉
