# Manual Webhook Registration Guide

## Problem
The Shopify automated checks are still showing failures even though the webhook code is deployed. This is because webhooks need to be **explicitly registered** in Shopify Admin.

## Solution

### Step 1: Find Your Deployment URL

Check your Render.com or deployment dashboard for your app's domain:
- **Render.com**: Your domain is `https://{your-service-name}.onrender.com`
- **Heroku**: Your domain is `https://{your-app-name}.herokuapp.com`
- **Other**: Check your deployment provider's dashboard

Example: `https://krosspost-production.onrender.com`

### Step 2: Register Webhooks in Shopify Admin

Go to your Shopify Partner Dashboard:

1. **Navigate to**: Your App → Configuration
2. **Find**: Webhooks section
3. **Add New Webhook** for each of these topics:

#### Webhook 1: Customer Data Request
- **Topic**: `customers/data_request`
- **URL**: `https://YOUR_DOMAIN/webhooks/shopify/customers/data_request`
- **Format**: JSON
- **API Version**: 2025-10

#### Webhook 2: Customer Redaction
- **Topic**: `customers/redact`
- **URL**: `https://YOUR_DOMAIN/webhooks/shopify/customers/redact`
- **Format**: JSON
- **API Version**: 2025-10

#### Webhook 3: Shop Redaction
- **Topic**: `shop/redact`
- **URL**: `https://YOUR_DOMAIN/webhooks/shopify/shop/redact`
- **Format**: JSON
- **API Version**: 2025-10

### Step 3: Verify Webhooks

After registering, verify they work:

```bash
# Test that your endpoint is accessible
curl -I https://YOUR_DOMAIN/webhooks/shopify/customers/data_request

# Should return: 200 OK or 401 Unauthorized (if HMAC verification is enabled)
```

### Step 4: Run Automated Checks Again

1. Go back to your Shopify App's Requirements Checklist
2. Click the **"Run"** button
3. Shopify will verify:
   - ✅ Your endpoints respond to HTTPS requests
   - ✅ You verify HMAC signatures (returns 401 for invalid)
   - ✅ You implement all three webhooks

### Step 5: Check Results

Wait 2-5 minutes for Shopify to verify. You should see:
- ✅ Provides mandatory compliance webhooks
- ✅ Verifies webhooks with HMAC signatures

## Troubleshooting

### "Webhook URL not accessible"
**Problem**: Shopify can't reach your endpoint
**Solution**:
1. Verify domain has valid SSL: `https://YOUR_DOMAIN/` should load in browser
2. Check endpoint directly: `curl https://YOUR_DOMAIN/webhooks/shopify/customers/data_request`
3. Verify APP_URL environment variable matches your domain

### "Invalid HMAC" or "401 Unauthorized"
**Problem**: HMAC verification is working! This is expected.
**Solution**: This is correct behavior. Shopify expects 401 for invalid HMAC.

### Webhooks don't appear after registration
**Problem**: Check that you're in the right app
**Solution**:
1. Verify you're in Shopify **App Admin** (not Store Admin)
2. Settings > Apps and integrations > Webhooks
3. Should show all three webhooks listed

## API Credentials Needed

Make sure these are set in your environment:

```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
APP_URL=https://YOUR_DOMAIN
```

Verify in Render.com (or your deployment provider):
- Settings → Environment Variables
- All three variables should be present

## Using Shopify CLI (Alternative)

If you prefer CLI:

```bash
# Install Shopify CLI
npm install -g @shopify/cli

# Authenticate
shopify auth login

# Trigger webhook registration
shopify app webhook trigger --topic customers/data_request
shopify app webhook trigger --topic customers/redact
shopify app webhook trigger --topic shop/redact
```

## Next: App Requirements Checklist

After webhooks are registered and verified, check these other items:

- ✅ Immediately authenticates after install
- ✅ Immediately redirects to app UI after authentication
- ✅ **Provides mandatory compliance webhooks** ← YOUR FOCUS
- ✅ **Verifies webhooks with HMAC signatures** ← YOUR FOCUS
- ✅ Uses a valid TLS certificate (HTTPS)

Once all checks pass, you can submit your app for Shopify review!
