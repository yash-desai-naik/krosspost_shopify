<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# [https://apps.shopify.com/claimbase](https://apps.shopify.com/claimbase) how does this work? i want to make same

This app connects Instagram interactions (comments, DMs, lives) to your Shopify store, detects “claim” messages for specific products/variants, reserves inventory, and then auto-creates draft orders plus checkout links in DMs.[^1]

## What Claimbase basically does

- Listens to Instagram events (live chat, comments, story replies, DMs) via the Instagram Graph API connected to a Facebook app.[^1]
- Matches each “claim” message to a Shopify product/variant using SKU/barcode/metafield/sequence IDs configured in Shopify.[^1]
- Creates/updates draft orders in Shopify, reserves stock for a configurable time, and sends a private checkout URL via Instagram DM within seconds.[^1]
- Provides a **dashboard** where the merchant sees all claims (success + failed), payment deadlines, and analytics for live/story/feed/DM sales.[^1]


## High‑level system architecture

To build a similar system, you need these core pieces:

- **Shopify app (custom/public)**
    - OAuth with Shopify, read/write access to Products, Draft Orders, Orders, Inventory.[^1]
    - Embedded app UI inside Shopify Admin for configuration + claims dashboard.[^1]
- **Instagram integration service**
    - Facebook Developer app with Instagram Messaging \& Webhooks permissions.[^1]
    - Subscriptions to IG webhooks: comments, mentions, story replies, DMs, live comments.[^1]
    - A rules engine that interprets messages like:
        - `sold 23`, `claim #23`, `M RED`, `sku:ABC123`, etc.
        - Maps to product/variant via SKU/barcode/metafield/auto ID.[^1]
- **Order + inventory engine**
    - Reservation logic:
        - When a valid claim arrives, create/update a draft order for that customer.[^1]
        - Reduce available stock or mark as “held” for N minutes (cart hold time).[^1]
    - Payment deadlines: if not paid in time, cancel reservation and optionally release to next interested customer (waitlist).[^1]
- **Messaging engine**
    - Sends Instagram DMs with:
        - Checkout URL
        - Payment deadline text, order summary, reminders.[^1]
    - Handles anti-spam / throttling so you do not get blocked for sending too many messages from lives.[^1]
- **Analytics + admin UI**
    - Real-time stats for live sales: claimed items, paid/unpaid, revenue, drop-off.[^1]
    - Filters by session (live event), channel (feed/story/live/DM), product, customer.


## Data model \& flows (simplified)

**Key entities**

- Shop: Shopify shop, tokens, IG account connection.
- ProductVariant: Shopify product/variant with claim identifiers (SKU/barcode/metafields/sequential ID).[^1]
- LiveEvent: optional grouping for each IG live or sale campaign.
- Claim: one message that tries to reserve a specific variant (status: pending, reserved, expired, failed).[^1]
- Cart/OrderSession: all claims for a given user within a sale window.
- DraftOrder/Order: mapped to Shopify draft order and final order ids.

**Main flow example**

1. Merchant connects Shopify store and Instagram account inside your app.[^1]
2. Merchant starts an IG live and shows items labeled `#1, #2...` or with SKUs.[^1]
3. Customer comments: `sold 2` → IG webhook → your backend receives event.[^1]
4. Backend parses `2`, finds matching variant via configured mapping.[^1]
5. Backend checks inventory, creates/updates draft order in Shopify with reservation TTL.[^1]
6. Backend sends IG DM: “Item \#2 reserved, pay here: <checkout_link> (valid 15 minutes).”[^1]
7. When customer pays, Shopify order is created; your app updates claim+analytics.
8. If unpaid after TTL, release inventory, mark claim expired, optionally notify next in queue.[^1]

## Tech stack suggestions (for you specifically)

Given your background, a pragmatic stack:

- **Backend**
    - Node/TypeScript (NestJS/Fastify/Express) for webhook-heavy API.
    - PostgreSQL for claims, events, reservations, analytics.
    - Redis for rate limiting and short‑term reservations (TTL).
- **Shopify app**
    - Use Shopify’s Remix App Template or a custom Node app with Shopify-auth library.
    - Embedded UI: React + Polaris components (so it feels native in Shopify Admin).[^1]
- **Instagram/Facebook**
    - Facebook Graph API (Instagram Messaging API + Webhooks).
    - Message templates for DMs, plus rate limiting management.[^1]
- **Infra**
    - Public HTTPS endpoints for Shopify + FB webhooks (e.g., Cloudflare Tunnel, Fly.io, Render, or your own VPS).
    - Background workers (BullMQ / Quartz / Temporal) for:
        - Expiring reservations
        - Sending reminders
        - Calculating analytics


## Steps to build an MVP

1. **Set up a basic Shopify embedded app**
    - Installable on your dev store.
    - Can read Products, create Draft Orders, and view Orders.[^1]
2. **Add a minimal claims model**
    - Manually create claims via your UI to test draft order creation + reservation logic.
    - Store mapping between product variants and claim IDs (SKU/barcode/metafield).[^1]
3. **Integrate Instagram webhooks**
    - Facebook app + IG account; subscribe to DMs/comments.[^1]
    - Build parser for messages → create `Claim` → draft order.

```
- Hardcode simple patterns first: `sold <number>`, `#<number>`.  
```

4. **Send DM with checkout URL**
    - After creating draft order, send a single DM with link + deadline.[^1]
    - For MVP, skip complex reminders/waitlists.
5. **Build a simple claims dashboard**
    - Table view with filters: channel, status, customer, product.[^1]
    - Actions: mark as paid (sync from Shopify), cancel reservation, resend link.
6. **Add “cart hold” \& payment deadlines**
    - Reservation TTL in config (e.g., 15/30/60 minutes).[^1]
    - Worker that auto‑expires reservations and releases inventory.
7. **Polish for production**
    - Handling blocked/bounced comments, error logging, retries.[^1]
    - Analytics page per live event (claims, conversion, revenue).

If you want, next step can be a more concrete technical blueprint: DB schema (tables for claims, events, carts), the exact webhook routes for Shopify and IG, and a basic architecture diagram in text tailored to how you like to structure your Node/TS services.

<div align="center">⁂</div>

[^1]: https://apps.shopify.com/claimbase

