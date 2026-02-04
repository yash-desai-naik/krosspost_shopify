# Shopify Compliance Webhooks Implementation

## Overview

This app now implements all mandatory compliance webhooks required by Shopify for public apps listed on the Shopify App Store. These webhooks handle data subject requests under GDPR, CPRA, and other privacy regulations.

## Implemented Webhooks

### 1. `customers/data_request`
**Endpoint:** `POST /webhooks/shopify/customers/data_request`

Triggered when a customer requests their data from the store owner.

**Payload:**
```json
{
  "shop_id": 954889,
  "shop_domain": "{shop}.myshopify.com",
  "orders_requested": [299938, 280263, 220458],
  "customer": {
    "id": 191167,
    "email": "john@example.com",
    "phone": "555-625-1199"
  },
  "data_request": {
    "id": 9999
  }
}
```

**Requirements:**
- ✅ App must respond with a 200 status code to acknowledge receipt
- ✅ App must complete the action within 30 days
- ✅ App must gather all customer data the app has collected
- ✅ App records are stored in `compliance_requests` table for audit

**Current Implementation:**
- Verifies HMAC signature
- Stores request in `compliance_requests` table
- Logs the request for audit purposes
- Returns 200 status to acknowledge

### 2. `customers/redact`
**Endpoint:** `POST /webhooks/shopify/customers/redact`

Triggered when a store owner requests that customer data be deleted on the customer's behalf.

**Payload:**
```json
{
  "shop_id": 954889,
  "shop_domain": "{shop}.myshopify.com",
  "customer": {
    "id": 191167,
    "email": "john@example.com",
    "phone": "555-625-1199"
  },
  "orders_to_redact": [299938, 280263, 220458]
}
```

**Requirements:**
- ✅ App must respond with a 200 status code to acknowledge receipt
- ✅ App must delete all personal data for this customer
- ✅ App has 30 days to complete the redaction
- ✅ If unable to comply due to legal retention requirements, must not delete

**Current Implementation:**
- Verifies HMAC signature
- Deletes all claims associated with the customer
- Records the redaction request in `compliance_requests` table
- Returns 200 status to acknowledge

### 3. `shop/redact`
**Endpoint:** `POST /webhooks/shopify/shop/redact`

Triggered 48 hours after a store owner uninstalls the app. This is the final notice to delete all data for the shop.

**Payload:**
```json
{
  "shop_id": 954889,
  "shop_domain": "{shop}.myshopify.com"
}
```

**Requirements:**
- ✅ App must respond with a 200 status code to acknowledge receipt
- ✅ App must delete ALL data for this shop immediately
- ✅ No time extension available

**Current Implementation:**
- Verifies HMAC signature
- Deletes all claims, campaigns, mapping rules, and shop data
- Records the shop redaction in `compliance_requests` table
- Returns 200 status to acknowledge

## Security: HMAC Signature Verification

All webhook endpoints verify the `X-Shopify-Hmac-SHA256` header to ensure requests are authentic.

**Implementation:**
```typescript
function verifyShopifyWebhookHMAC(
  body: string,
  hmacHeader: string,
  apiSecret: string
): boolean {
  const hmac = crypto
    .createHmac('sha256', apiSecret)
    .update(body, 'utf8')
    .digest('base64');
  return crypto.timingSafeEqual(hmac, Buffer.from(hmacHeader)) !== false;
}
```

**Verification Flow:**
1. ✅ Request must include `X-Shopify-Hmac-SHA256` header
2. ✅ HMAC is computed using the raw body and your API secret
3. ✅ Computed HMAC is compared to the header value using timing-safe comparison
4. ✅ Invalid signatures return 401 Unauthorized

## Configuration

### Local Development

For local development, you need to expose your local server to the internet:

1. **Install ngrok:**
   ```bash
   # macOS
   brew install ngrok
   
   # Or download from https://ngrok.com/
   ```

2. **Start ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```

3. **Update `shopify.app.toml`:**
   ```toml
   [[webhooks.subscriptions]]
   uri = "https://your-ngrok-url.ngrok.io/webhooks/shopify/customers/data_request"
   ```

4. **Run your app:**
   ```bash
   npm run dev
   ```

### Production Deployment

1. Update `shopify.app.toml` with your production domain:
   ```toml
   [[webhooks.subscriptions]]
   uri = "https://your-domain.com/webhooks/shopify/customers/data_request"
   ```

2. Ensure your app has:
   - ✅ Valid TLS certificate (HTTPS)
   - ✅ API secret configured in `SHOPIFY_API_SECRET` environment variable
   - ✅ All three webhook endpoints accessible

3. Register webhooks using Shopify CLI:
   ```bash
   shopify app webhook trigger --topic customers/data_request
   ```

## Audit Trail

All compliance requests are logged in the `compliance_requests` table with:
- `shop_id`: The shop this request applies to
- `request_type`: "data_request", "redact", or "shop_redact"
- `shopify_request_id`: Unique ID from Shopify
- `customer_email`: Email of the affected customer (if applicable)
- `request_data`: Full webhook payload for audit
- `processed_at`: When we completed the action
- `created_at`: Timestamp of when we received the request

## Testing

### Manual Webhook Testing

Shopify CLI allows you to manually trigger webhook deliveries:

```bash
# Test data_request webhook
shopify app webhook trigger --topic customers/data_request

# Test redact webhook
shopify app webhook trigger --topic customers/redact

# Test shop redact webhook
shopify app webhook trigger --topic shop/redact
```

### Verification Checklist

Before submitting your app for review:

- [ ] All three webhook endpoints are accessible at the registered URLs
- [ ] Each endpoint returns 200 status code when receiving valid requests
- [ ] HMAC signatures are verified correctly
- [ ] Customer data is properly deleted on redaction requests
- [ ] Shop data is fully deleted on shop/redact
- [ ] Audit trail is maintained in `compliance_requests` table
- [ ] Valid TLS certificate is installed (HTTPS only)

## Privacy Requirements

In addition to webhooks, ensure you have:

1. **Privacy Policy**
   - Published on your website
   - Clearly states what personal data you collect
   - Explains how data is used and stored
   - Describes how users can request data or deletion

2. **Data Retention Policy**
   - Define how long you keep customer data
   - Explain why you keep it (business, legal, etc.)
   - Provide means to comply with deletion requests

3. **Third-Party Integrations**
   - Document all third-party services that receive customer data
   - Ensure they have privacy policies
   - Include in your compliance audit trail

## Resources

- [Shopify Privacy Law Compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Shopify App Requirements Checklist](https://shopify.dev/docs/apps/launch/app-requirements-checklist)
- [Shopify Webhooks Guide](https://shopify.dev/docs/apps/build/webhooks)
- [GDPR Compliance](https://gdpr-info.eu/)
- [CPRA Compliance](https://cppa.ca.gov/)
