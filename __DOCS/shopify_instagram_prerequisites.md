# Shopify + Instagram Claims App — Prerequisites (Before Coding)

This document lists everything you should have ready before starting implementation: accounts, app setup, credentials, webhook URLs, and an `.env` template.

---

## 1) Accounts you must have

### Shopify
- Shopify Partner account
- A Shopify development store (for installing/testing your app)
- Access to create/manage an app in the Partner Dashboard

### Meta / Instagram
- Meta (Facebook) Developer account
- A Meta Business (recommended) with access to:
  - A Facebook Page
  - An Instagram Professional account (Business/Creator) connected to that Page
- Ability to create a Meta App and add products:
  - Instagram Graph API
  - Webhooks
  - Messenger / Instagram Messaging (depending on your exact approach)

---

## 2) Shopify app setup checklist (credentials + configuration)

### Create the Shopify app
- Create a public (or custom) app in Shopify Partner dashboard.
- Record:
  - App name
  - Client ID (API key)
  - Client secret

### Configure OAuth
- Decide the app base URL (dev) and allowed redirect URLs.
- Prepare:
  - `SHOPIFY_APP_URL` (public HTTPS URL)
  - `SHOPIFY_AUTH_CALLBACK_URL` (full callback URL)

### Scopes (from your tasks doc)
- Required:
  - `read_products`
  - `read_inventory`
  - `write_draft_orders`
  - `write_orders`
  - `read_customers`
  - `write_customers`
- Optional (future):
  - `read_all_orders`

### Webhooks
- Configure uninstall webhook (and optionally order paid/updated webhooks).
- Identify your endpoints, for example:
  - `/webhooks/shopify/app_uninstalled`
  - `/webhooks/shopify/orders_paid` (optional)

---

## 3) Meta / Instagram app setup checklist

### Create Meta App
- Create a Meta App in Meta Developers.
- Record:
  - Meta App ID
  - Meta App Secret

### Connect Instagram account
- Ensure the IG account is:
  - Professional (Business/Creator)
  - Connected to a Facebook Page

### Permissions / Access
Exact permissions vary by implementation, but you should plan for:
- Reading IG comments / mentions (Graph API)
- Receiving webhooks for the subscribed fields
- Sending messages (Instagram Messaging)

You will also need to plan for:
- Meta review / app mode (Development vs Live)
- Testing with roles (app admins/testers) during development

### Webhooks
- Provide a public webhook base URL.
- Prepare:
  - Verify token (string you choose)
  - Webhook path(s), for example:
    - `/webhooks/meta`
- Plan to store and validate:
  - Webhook signatures (where applicable)

### Policy constraints you must follow
- Meta 24-hour messaging rule enforcement (design your DM flows accordingly)
- Rate limiting / throttling (especially during lives / high-volume comment streams)

---

## 4) Public HTTPS URL (required)

Both Shopify and Meta require publicly reachable HTTPS endpoints.

Pick one approach before coding:
- Cloudflare Tunnel
- ngrok (quick dev)
- A small public dev server (Render/Fly/VPS)

You should have 2 stable URLs ready:
- App base URL (for Shopify embedded app)
- Webhook URL(s) (Shopify + Meta)

---

## 5) Data storage & infra prerequisites

### Database
- Postgres connection URL (local or hosted)
- Decide how you’ll manage migrations (tooling depends on your codebase)

### Redis (recommended)
- Redis URL for:
  - Rate limiting
  - Short TTL holds / job queues (if used)

### Background jobs
- Decide the job runner approach for:
  - Expiring holds
  - Sending delayed reminders
  - Reconciliation (order paid -> mark claim paid)

---

## 6) Security & operational prerequisites

- A session/auth secret for your app
- Webhook secrets/tokens stored only in environment variables
- Basic logging/monitoring plan (even for MVP):
  - request IDs
  - webhook event logging (with PII-safe redaction)
  - error reporting target (console/log file/SaaS)

---

## 7) `.env` template

Create a local `.env` file (do not commit it). This template is intentionally generic; adjust names to match your codebase.

```bash
# ---------------------------
# App / Server
# ---------------------------
NODE_ENV=development
PORT=3000
APP_URL=https://your-public-https-url.example.com
SESSION_SECRET=replace_me_with_long_random

# ---------------------------
# Database / Cache
# ---------------------------
DATABASE_URL=postgresql://user:pass@localhost:5432/krosspost_shopify
REDIS_URL=redis://localhost:6379

# ---------------------------
# Shopify
# ---------------------------
SHOPIFY_API_KEY=replace_me
SHOPIFY_API_SECRET=replace_me
SHOPIFY_SCOPES=read_products,read_inventory,write_draft_orders,write_orders,read_customers,write_customers
SHOPIFY_AUTH_CALLBACK_URL=https://your-public-https-url.example.com/auth/shopify/callback

# Shopify webhooks (if you validate signatures / need shared secret)
SHOPIFY_WEBHOOKS_PATH=/webhooks/shopify

# ---------------------------
# Meta / Instagram
# ---------------------------
META_APP_ID=replace_me
META_APP_SECRET=replace_me
META_WEBHOOK_VERIFY_TOKEN=replace_me_choose_any_string
META_WEBHOOK_PATH=/webhooks/meta

# If you need page/ig identifiers or long-lived tokens, store them here
META_PAGE_ID=
META_IG_BUSINESS_ACCOUNT_ID=
META_ACCESS_TOKEN=

# ---------------------------
# Operational / Logging
# ---------------------------
LOG_LEVEL=info
```

---

## 8) Final pre-coding checklist (quick)

- Shopify app created and OAuth redirect URL matches your public HTTPS `APP_URL`
- Shopify scopes agreed + documented (for App Store justification)
- Meta app created, IG professional account connected to FB page
- Meta webhooks configured with verify token + callback URL
- You have a stable HTTPS URL for both Shopify + Meta to call
- Postgres + Redis ready (local or hosted)
- `.env` created locally and secrets are not committed
