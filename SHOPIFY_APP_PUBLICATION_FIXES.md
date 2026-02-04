# Shopify App Publication Fixes

## Issues Fixed

### ✅ 1. OAuth Redirect After Authentication
**Problem**: App was redirecting to `https://{shop}/admin/apps/{api_key}` instead of the embedded app URL.

**Solution**: Updated `/auth/shopify/callback` to redirect to `{APP_URL}/?shop={shop}&host={host}` for embedded app flow.

**File**: `src/routes/shopify-auth.ts`

### ✅ 2. Compliance Webhooks Registration
**Problem**: Shopify requires mandatory compliance webhooks to be registered.

**Solution**: Already configured in `shopify.app.toml`:
- `customer_data_request_url`: `/webhooks/shopify/customers/data_request`
- `customer_deletion_url`: `/webhooks/shopify/customers/redact`
- `shop_deletion_url`: `/webhooks/shopify/shop/redact`

All three endpoints are implemented with:
- HMAC signature verification
- HEAD request handlers for health checks
- POST request handlers for actual webhooks
- Proper 200 OK responses

### ✅ 3. HMAC Signature Verification
**Problem**: Webhooks must verify HMAC signatures to ensure they come from Shopify.

**Solution**: Implemented in `src/index.ts`:
- Raw body capture using `express.json({ verify: ... })`
- HMAC verification using `crypto.createHmac('sha256', apiSecret)`
- Timing-safe comparison using `crypto.timingSafeEqual()`
- Applied to all three compliance webhooks

## Configuration Checklist

### Environment Variables (Update in Render Dashboard)
Make sure these are set in your Render environment:

```bash
NODE_ENV=production
PORT=10000  # Or whatever Render assigns
APP_URL=https://instakrosspost.onrender.com
SESSION_SECRET=<generate-a-long-random-string>

DATABASE_URL=<your-postgres-url>
REDIS_URL=<your-redis-url>

SHOPIFY_API_KEY=<your-shopify-api-key>
SHOPIFY_API_SECRET=<your-shopify-api-secret>
SHOPIFY_SCOPES=read_products,read_inventory,write_draft_orders,write_orders,read_customers,write_customers
SHOPIFY_AUTH_CALLBACK_URL=https://instakrosspost.onrender.com/auth/shopify/callback

META_APP_ID=<your-meta-app-id>
META_APP_SECRET=<your-meta-app-secret>
META_WEBHOOK_VERIFY_TOKEN=<your-webhook-verify-token>
META_WEBHOOK_PATH=/webhooks/meta
```

### shopify.app.toml Configuration
Ensure this file has the correct values:

```toml
client_id = "<your-shopify-api-key>"
name = "Krosspost"
application_url = "https://instakrosspost.onrender.com"
embedded = true

[auth]
redirect_urls = ["https://instakrosspost.onrender.com/auth/shopify/callback"]

[webhooks]
api_version = "2025-10"
customer_data_request_url = "https://instakrosspost.onrender.com/webhooks/shopify/customers/data_request"
customer_deletion_url = "https://instakrosspost.onrender.com/webhooks/shopify/customers/redact"
shop_deletion_url = "https://instakrosspost.onrender.com/webhooks/shopify/shop/redact"
```

## Deployment Steps

1. **Update shopify.app.toml** with your actual API key (from Partner Dashboard)

2. **Update Environment Variables on Render**:
   - Change `APP_URL` to: `https://instakrosspost.onrender.com`
   - Change `SHOPIFY_AUTH_CALLBACK_URL` to: `https://instakrosspost.onrender.com/auth/shopify/callback`
   - Ensure `NODE_ENV=production`
   - Set all other environment variables from your `.env` file

3. **Push to Git** (triggers auto-deploy on Render):
   ```bash
   git add .
   git commit -m "Fix Shopify app publication issues"
   git push origin main
   ```

4. **Verify Deployment**:
   - Check Render dashboard for successful build
   - Test health endpoint: `https://instakrosspost.onrender.com/health`

5. **Test Compliance Webhooks**:
   ```bash
   # Test HEAD requests (health checks)
   curl -I https://instakrosspost.onrender.com/webhooks/shopify/customers/data_request
   curl -I https://instakrosspost.onrender.com/webhooks/shopify/customers/redact
   curl -I https://instakrosspost.onrender.com/webhooks/shopify/shop/redact
   ```

6. **Run Shopify Automated Checks**:
   - Go to Shopify Partner Dashboard
   - Navigate to your app
   - Click "Run" on the automated checks
   - All checks should now pass ✅

## Common Issues & Solutions

### Issue: "Immediately redirects to app UI after authentication"
**Cause**: Missing `host` parameter in redirect URL
**Fix**: Redirect to `{APP_URL}/?shop={shop}&host={host}` ✅ FIXED

### Issue: "Provides mandatory compliance webhooks"
**Cause**: Webhooks not registered or not responding
**Fix**: Webhooks registered in TOML and implemented ✅ FIXED

### Issue: "Verifies webhooks with HMAC signatures"
**Cause**: Not verifying HMAC or using parsed body instead of raw
**Fix**: Using raw body capture and proper HMAC verification ✅ FIXED

### Issue: "Uses a valid TLS certificate"
**Cause**: Using HTTP instead of HTTPS
**Fix**: Render provides HTTPS by default ✅ FIXED

## Testing OAuth Flow

1. Visit: `https://instakrosspost.onrender.com/auth/shopify?shop=YOUR-STORE.myshopify.com`
2. Authorize the app
3. Should redirect to: `https://instakrosspost.onrender.com/?shop=YOUR-STORE.myshopify.com&host=...`
4. Embedded app UI should load

## Next Steps After Publication

1. Test Instagram webhook integration
2. Create test campaigns
3. Add mapping rules
4. Test claim processing flow
5. Monitor logs for any issues

## Support

If issues persist:
1. Check Render logs: `https://dashboard.render.com/`
2. Check Shopify Partner Dashboard for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure database migrations have run: `npm run db:migrate`
