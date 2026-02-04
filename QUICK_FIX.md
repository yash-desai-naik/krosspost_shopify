# ⚡ IMMEDIATE ACTIONS TO FIX SHOPIFY CHECKS

Your app domain: **https://instakrosspost.onrender.com**

## What You Need To Do RIGHT NOW

### Option A: Register Webhooks Using Shopify CLI (Fastest)

```bash
# 1. Install Shopify CLI (if not already installed)
npm install -g @shopify/cli

# 2. Login to Shopify
shopify auth login

# 3. Register the three compliance webhooks
shopify app webhook trigger --topic customers/data_request
shopify app webhook trigger --topic customers/redact
shopify app webhook trigger --topic shop/redact
```

✅ This should register all three webhooks immediately.

---

### Option B: Manual Registration in Shopify Partner Dashboard

If CLI doesn't work, register manually:

1. **Go to**: Shopify Partner Dashboard → Your App → Configuration
2. **Find**: "Webhooks" section
3. **For each webhook below, click "Add" and fill in:**

#### Webhook #1: Customer Data Request
```
Topic: customers/data_request
URL: https://instakrosspost.onrender.com/webhooks/shopify/customers/data_request
Format: JSON
API Version: 2024-07
```

#### Webhook #2: Customer Redaction
```
Topic: customers/redact
URL: https://instakrosspost.onrender.com/webhooks/shopify/customers/redact
Format: JSON
API Version: 2024-07
```

#### Webhook #3: Shop Redaction
```
Topic: shop/redact
URL: https://instakrosspost.onrender.com/webhooks/shopify/shop/redact
Format: JSON
API Version: 2024-07
```

---

### Step 4: Verify Webhooks Are Working

Test your endpoints:
```bash
# Test that endpoints are accessible (should return 401 for missing HMAC header)
curl -v https://instakrosspost.onrender.com/webhooks/shopify/customers/data_request
curl -v https://instakrosspost.onrender.com/webhooks/shopify/customers/redact
curl -v https://instakrosspost.onrender.com/webhooks/shopify/shop/redact

# Should see:
# < HTTP/1.1 401 Unauthorized
# < Content-Type: application/json
# {"error":"Unauthorized: Missing HMAC header"}
```

✅ This means webhooks are properly deployed and checking for HMAC signatures!

---

### Step 5: Re-Run Shopify App Review Checks

1. Go to your app's **Requirements Checklist**
2. Click the **"Run"** button
3. Wait 2-5 minutes for checks to complete
4. You should now see ✅ for:
   - ✅ Provides mandatory compliance webhooks
   - ✅ Verifies webhooks with HMAC signatures

---

## What Was Deployed

Your webhooks are already deployed at these URLs:
- ✅ `https://instakrosspost.onrender.com/webhooks/shopify/customers/data_request`
- ✅ `https://instakrosspost.onrender.com/webhooks/shopify/customers/redact`
- ✅ `https://instakrosspost.onrender.com/webhooks/shopify/shop/redact`

They all:
- ✅ Verify HMAC-SHA256 signatures
- ✅ Return 401 for invalid/missing HMAC
- ✅ Return 200 for valid requests
- ✅ Delete customer/shop data on redaction
- ✅ Log all requests for audit trail

---

## If It Still Doesn't Work

### Check 1: Is Render deployment updated?
```bash
# Force redeploy on Render:
# 1. Go to Render.com dashboard
# 2. Select "krosspost" service
# 3. Click "Manual Deploy" → "Deploy Latest Commit"
# 4. Wait for green checkmark
```

### Check 2: Verify endpoint responds
```bash
# Test endpoint directly
curl -I https://instakrosspost.onrender.com/webhooks/shopify/customers/data_request

# Should see: HTTP/1.1 401 or 200 (not 404 or 502)
```

### Check 3: Check environment variables on Render
1. Go to Render dashboard → krosspost service
2. Click "Environment"
3. Verify these are set:
   - `SHOPIFY_API_KEY` ✓
   - `SHOPIFY_API_SECRET` ✓
   - `APP_URL=https://instakrosspost.onrender.com` ✓

### Check 4: View deployment logs
1. Render dashboard → krosspost service
2. Click "Logs"
3. Should see:
   ```
   ✓ Server running on https://instakrosspost.onrender.com
   - Shopify Compliance Webhooks:
     • customers/data_request: https://instakrosspost.onrender.com/webhooks/shopify/customers/data_request
     • customers/redact: https://instakrosspost.onrender.com/webhooks/shopify/customers/redact
     • shop/redact: https://instakrosspost.onrender.com/webhooks/shopify/shop/redact
   ```

---

## Support

📖 See [WEBHOOK_REGISTRATION.md](./WEBHOOK_REGISTRATION.md) for detailed troubleshooting
📖 See [COMPLIANCE_WEBHOOKS.md](./COMPLIANCE_WEBHOOKS.md) for technical details
