# Complete Setup Guide - Krosspost Shopify

This guide walks you through setting up the Instagram Claims to Shopify Draft Orders app from scratch.

## Part 1: Prerequisites Setup (30-60 minutes)

### 1.1 Shopify Partner Account & Development Store

1. **Create Shopify Partner Account** (if you don't have one)
   - Go to https://partners.shopify.com/signup
   - Complete registration

2. **Create Development Store**
   - In Partner Dashboard → Stores → Add store
   - Select "Development store"
   - Fill in store details
   - Note your store URL: `coffee-ba.myshopify.com`

### 1.2 Create Shopify App

1. **In Partner Dashboard → Apps → Create app**
   - Choose "Create app manually"
   - App name: "Krosspost Instagram Claims"
   - App URL: `https://your-public-url.com` (we'll set this up later)

2. **Configure App Settings**
   - Go to Configuration tab
   - **App URL**: `https://your-public-url.com`
   - **Allowed redirection URL(s)**: `https://your-public-url.com/auth/shopify/callback`
   - **Embedded app**: Yes (check this)

3. **Set API Scopes**
   - Click "Configure" under "Admin API access scopes"
   - Select:
     - ✅ `read_products`
     - ✅ `read_inventory`
     - ✅ `write_draft_orders`
     - ✅ `write_orders`
     - ✅ `read_customers`
     - ✅ `write_customers`

4. **Copy Credentials**
   - **Client ID** (API key)
   - **Client secret** (API secret key)
   - Save these for your `.env` file

5. **Configure Webhooks**
   - Go to Webhooks section
   - Add webhook:
     - Event: `app/uninstalled`
     - URL: `https://your-public-url.com/webhooks/shopify/app_uninstalled`
     - Format: JSON

### 1.3 Meta Developer Account & Instagram Setup

1. **Create Meta Developer Account**
   - Go to https://developers.facebook.com/
   - Sign up or log in
   - Complete identity verification if required

2. **Create Meta App**
   - Click "Create App"
   - Use case: "Other"
   - App type: "Business"
   - App name: "Krosspost Instagram"
   - Contact email: your email

3. **Add Instagram Product**
   - In App Dashboard → Add Product
   - Find "Instagram" → Set up
   - Also add "Webhooks" product

4. **Configure Instagram**
   - Go to Instagram → Basic Display
   - Note your:
     - **App ID**
     - **App Secret**

5. **Connect Instagram Business Account**
   - You need:
     - A Facebook Page
     - An Instagram Professional account (Business or Creator)
     - The Instagram account connected to the Facebook Page
   
   - Go to Instagram → Settings
   - Add Instagram account
   - Follow the flow to connect your IG Business account

6. **Get Access Token**
   - Use Graph API Explorer: https://developers.facebook.com/tools/explorer/
   - Select your app
   - Select your Page
   - Get Token → Get Page Access Token
   - Add permissions:
     - `pages_manage_metadata`
     - `pages_read_engagement`
     - `instagram_basic`
     - `instagram_manage_messages`
     - `instagram_manage_comments`
   - Generate token
   - **Important**: Exchange for long-lived token (60 days):
     ```bash
     curl -i -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
     ```

7. **Get Instagram Business Account ID**
   - In Graph API Explorer:
     ```
     GET /me/accounts
     ```
   - Find your page, then:
     ```
     GET /{page-id}?fields=instagram_business_account
     ```
   - Note the `instagram_business_account.id`

8. **Configure Webhooks**
   - Go to Webhooks in Meta App Dashboard
   - Subscribe to Page
   - Callback URL: `https://your-public-url.com/webhooks/meta`
   - Verify token: Choose a random string (e.g., `my_verify_token_123`)
   - Subscribe to fields:
     - ✅ `messages`
     - ✅ `messaging_postbacks`
     - ✅ `feed` (for comments)

### 1.4 Database Setup

**Option A: Local PostgreSQL**

1. Install PostgreSQL:
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`

2. Create database:
   ```bash
   psql -U postgres
   CREATE DATABASE krosspost_shopify;
   \q
   ```

3. Connection string:
   ```
   postgresql://postgres:password@localhost:5432/krosspost_shopify
   ```

**Option B: Hosted PostgreSQL (Recommended for production)**

- **Neon**: https://neon.tech (free tier available)
- **Supabase**: https://supabase.com (free tier available)
- **Railway**: https://railway.app
- **Heroku Postgres**: https://www.heroku.com/postgres

### 1.5 Redis Setup

**Option A: Local Redis**

1. Install Redis:
   - Windows: Use WSL or download from https://github.com/microsoftarchive/redis/releases
   - Mac: `brew install redis`
   - Linux: `sudo apt-get install redis-server`

2. Start Redis:
   ```bash
   redis-server
   ```

3. Connection string:
   ```
   redis://localhost:6379
   ```

**Option B: Hosted Redis (Recommended for production)**

- **Upstash**: https://upstash.com (free tier available)
- **Redis Cloud**: https://redis.com/cloud/
- **Railway**: https://railway.app

### 1.6 Public HTTPS URL

You need a public HTTPS URL for webhooks. Choose one:

**Option A: ngrok (Quick for development)**

1. Install: https://ngrok.com/download
2. Run:
   ```bash
   ngrok http 3000
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. **Note**: URL changes each time you restart ngrok (paid plan for static URLs)

**Option B: Cloudflare Tunnel (Free, persistent)**

1. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/
2. Run:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. Or set up a named tunnel for persistence

**Option C: Deploy to hosting (Production)**

- **Railway**: https://railway.app (easy deployment)
- **Render**: https://render.com (free tier)
- **Fly.io**: https://fly.io
- **DigitalOcean App Platform**: https://www.digitalocean.com/products/app-platform

## Part 2: Project Setup (10 minutes)

### 2.1 Install Dependencies

```bash
cd c:\Users\yash\Documents\work\krosspost_shopify
npm install
```

### 2.2 Configure Environment Variables

1. Copy the example file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` with your credentials:

```env
# App / Server
NODE_ENV=development
PORT=3000
APP_URL=https://your-ngrok-or-cloudflare-url.com
SESSION_SECRET=generate_a_random_string_here

# Database / Cache
DATABASE_URL=postgresql://user:pass@host:5432/krosspost_shopify
REDIS_URL=redis://host:6379

# Shopify (from Part 1.2)
SHOPIFY_API_KEY=your_shopify_client_id
SHOPIFY_API_SECRET=your_shopify_client_secret
SHOPIFY_SCOPES=read_products,read_inventory,write_draft_orders,write_orders,read_customers,write_customers
SHOPIFY_AUTH_CALLBACK_URL=https://your-public-url.com/auth/shopify/callback

# Meta / Instagram (from Part 1.3)
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_WEBHOOK_VERIFY_TOKEN=my_verify_token_123
META_WEBHOOK_PATH=/webhooks/meta

# Instagram credentials (from Part 1.3)
META_PAGE_ID=your_facebook_page_id
META_IG_BUSINESS_ACCOUNT_ID=your_ig_business_account_id
META_ACCESS_TOKEN=your_long_lived_access_token

# Logging
LOG_LEVEL=info
```

### 2.3 Run Database Migrations

```bash
npm run db:migrate
```

You should see: `✓ Migrations completed successfully`

## Part 3: Running the App (5 minutes)

### 3.1 Start Development Server

```bash
npm run dev
```

You should see:
```
✓ Database connected
✓ Background workers started
✓ Server running on https://your-url.com
  - Shopify OAuth: https://your-url.com/auth/shopify
  - Meta Webhooks: https://your-url.com/webhooks/meta
```

### 3.2 Test Webhook Endpoints

**Test Meta Webhook Verification:**
```bash
curl "https://your-url.com/webhooks/meta?hub.mode=subscribe&hub.verify_token=my_verify_token_123&hub.challenge=test123"
```

Should return: `test123`

**Test Health Endpoint:**
```bash
curl https://your-url.com/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## Part 4: Install App on Shopify (5 minutes)

### 4.1 Install via OAuth

1. Visit in browser:
   ```
   https://your-url.com/auth/shopify?shop=your-store.myshopify.com
   ```

2. You'll be redirected to Shopify to authorize

3. Click "Install app"

4. After authorization, you'll be redirected to the embedded admin UI

### 4.2 Verify Installation

Check your database:
```sql
SELECT * FROM shops;
```

You should see your store with access token.

## Part 5: Configure Instagram Integration (10 minutes)

### 5.1 In the Admin UI

1. Go to the embedded app in your Shopify admin
   - Or visit: `https://your-store.myshopify.com/admin/apps/your-app`

2. **Connect Instagram Section:**
   - Instagram Business Account ID: (from Part 1.3 step 7)
   - Instagram Access Token: (from Part 1.3 step 6)
   - Click "Connect Instagram"

### 5.2 Verify Webhook Subscription

In Meta App Dashboard:
1. Go to Webhooks
2. Check that your callback URL is subscribed
3. Test by sending a test event

## Part 6: Create Your First Campaign (10 minutes)

### 6.1 Create Campaign

In the admin UI:

1. **Campaign Name**: "Test Drop"
2. **Hold Time**: 15 minutes
3. **Per Person Limit**: Leave empty
4. Click "Create Campaign"
5. **Copy the Campaign ID** shown in the alert

### 6.2 Add Products to Shopify

In your Shopify development store:
1. Add a test product
2. Note the variant ID (you can get this from the product URL or API)

### 6.3 Add Mapping Rules

In the admin UI:

1. **Campaign ID**: (paste from 6.1)
2. **Strategy**: Sequential ID
3. **Trigger Pattern**: 1
4. **Shopify Variant ID**: (your variant ID)
5. Click "Add Mapping Rule"

Repeat for more products (#2, #3, etc.)

## Part 7: Test the Flow (5 minutes)

### 7.1 Test via Instagram DM

1. From a different Instagram account, send a DM to your connected IG Business account:
   ```
   sold 1
   ```

2. Check the Claims Board in admin UI (click Refresh)

3. You should see:
   - Status: `link_sent`
   - A checkout URL

4. Check your DMs - you should receive a message with the checkout link

### 7.2 Test via Comment (if configured)

1. Post something on Instagram
2. Comment: `claim 1`
3. Check Claims Board
4. Should receive DM with checkout link

## Part 8: Monitoring & Troubleshooting

### 8.1 Check Logs

Watch server logs for:
- Webhook events received
- Claim processing
- Draft order creation
- DM sending

### 8.2 Common Issues

**No webhooks received:**
- Verify webhook URL is publicly accessible
- Check Meta App Dashboard → Webhooks → Test
- Ensure verify token matches

**Draft orders not creating:**
- Check Shopify API scopes
- Verify variant ID is correct (numeric, not GID)
- Check inventory is available

**DMs not sending:**
- Verify access token is valid
- Check 24-hour messaging window
- Review Meta rate limits

**Claims not matching:**
- Verify mapping rules exist
- Check trigger pattern matches message
- Ensure campaign is active

### 8.3 Database Queries for Debugging

```sql
-- Check all claims
SELECT * FROM claims ORDER BY created_at DESC LIMIT 10;

-- Check active reservations
SELECT * FROM reservations WHERE released = false;

-- Check campaigns
SELECT * FROM campaigns WHERE is_active = true;

-- Check mapping rules
SELECT * FROM mapping_rules;
```

## Part 9: Production Deployment

### 9.1 Environment Setup

1. Deploy to your chosen hosting platform
2. Set all environment variables
3. Update `APP_URL` to production URL
4. Update Shopify app URLs in Partner Dashboard
5. Update Meta webhook URL

### 9.2 Security Checklist

- [ ] All secrets in environment variables (not committed)
- [ ] HTTPS enabled
- [ ] Session secret is strong and random
- [ ] Database has backups enabled
- [ ] Redis has persistence enabled
- [ ] Rate limiting configured
- [ ] Error monitoring set up (e.g., Sentry)

### 9.3 Shopify App Store Submission (Optional)

If you want to publish publicly:

1. Add app listing details in Partner Dashboard
2. Provide scope justifications
3. Add privacy policy and support URLs
4. Submit for review

## Support

For issues:
1. Check server logs
2. Review Meta App Dashboard for webhook errors
3. Check Shopify Partner Dashboard for API errors
4. Review database for claim statuses

---

**You're all set!** Your Instagram Claims to Shopify app is now running.
