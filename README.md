# Krosspost Shopify - Instagram Claims to Draft Orders

A Shopify app that converts Instagram comments and DMs into Shopify draft orders with automatic inventory reservations and checkout link delivery.

## 🎯 What It Does

- **Listens** to Instagram comments/DMs for claim triggers (e.g., "sold 23", "claim #5", "DROP1 M")
- **Matches** claims to Shopify product variants using configurable mapping rules
- **Creates** draft orders in Shopify with inventory holds
- **Sends** checkout links via Instagram DM with payment deadlines
- **Expires** reservations automatically after configurable hold time
- **Provides** an embedded admin dashboard for campaign management and claims tracking

## 📋 Prerequisites

Before you start, ensure you have:

1. **Accounts**
   - Shopify Partner account + development store
   - Meta Developer account
   - Instagram Professional account (Business/Creator) connected to a Facebook Page

2. **Infrastructure**
   - PostgreSQL database (local or hosted)
   - Redis instance (local or hosted)
   - Public HTTPS URL (ngrok, Cloudflare Tunnel, or hosting service)

3. **Credentials** (see `__DOCS/shopify_instagram_prerequisites.md` for details)
   - Shopify API key and secret
   - Meta App ID and secret
   - Instagram access token

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:
- Shopify API credentials
- Meta/Instagram credentials
- Database and Redis URLs
- Public app URL

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This creates all necessary tables (shops, campaigns, mapping_rules, claims, reservations).

### 4. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

The server will start on the port specified in your `.env` (default: 3000).

## 🔧 Configuration

### Shopify App Setup

1. Go to your Shopify Partner dashboard
2. Create a new app (or use existing)
3. Configure OAuth redirect URL: `https://your-domain.com/auth/shopify/callback`
4. Set required scopes:
   - `read_products`
   - `read_inventory`
   - `write_draft_orders`
   - `write_orders`
   - `read_customers`
   - `write_customers`
5. Add uninstall webhook: `https://your-domain.com/webhooks/shopify/app_uninstalled`

### Meta/Instagram Setup

1. Create a Meta App in Meta for Developers
2. Add Instagram Graph API product
3. Configure webhook:
   - Callback URL: `https://your-domain.com/webhooks/meta`
   - Verify Token: (same as `META_WEBHOOK_VERIFY_TOKEN` in `.env`)
   - Subscribe to: `messages`, `comments`, `messaging_postbacks`
4. Get a long-lived access token for your Instagram Business Account

## 📱 Usage

### Install the App

1. Visit: `https://your-domain.com/auth/shopify?shop=your-store.myshopify.com`
2. Authorize the app in Shopify
3. You'll be redirected to the embedded admin UI

### Connect Instagram

In the admin UI:
1. Enter your Instagram Business Account ID
2. Enter your Instagram access token
3. Click "Connect Instagram"

### Create a Campaign

1. Enter campaign name (e.g., "Summer Drop 2025")
2. Set hold time in minutes (how long to reserve inventory)
3. Optionally set per-person limit
4. Click "Create Campaign"
5. Copy the Campaign ID for mapping rules

### Add Mapping Rules

For each product/variant you want to sell via Instagram:

1. Select the campaign
2. Choose mapping strategy:
   - **Sequential ID**: Map #1, #2, #3 to specific variants
   - **SKU**: Match by product SKU
   - **Keyword**: Match keywords like "DROP1", "BLUE-M"
3. Enter the trigger pattern
4. Enter the Shopify variant ID
5. Click "Add Mapping Rule"

### Monitor Claims

Click "Refresh Claims" to see all claim attempts with:
- Status (new, matched, reserved, link_sent, paid, expired, etc.)
- Customer info
- Original message
- Checkout URL (if created)

## 🔄 Claim Flow

1. **Customer comments/DMs** on Instagram (e.g., "sold 23")
2. **Webhook received** by your app
3. **Message parsed** to extract intent
4. **Variant matched** using mapping rules
5. **Inventory checked** in Shopify
6. **Draft order created** with reservation
7. **DM sent** to customer with checkout link
8. **Timer started** for hold expiration
9. **Reservation expires** if not paid (background worker)

## 🛠️ API Endpoints

### Public Endpoints
- `GET /auth/shopify` - Start OAuth flow
- `GET /auth/shopify/callback` - OAuth callback
- `GET /webhooks/meta` - Meta webhook verification
- `POST /webhooks/meta` - Receive Instagram events
- `POST /webhooks/shopify/app_uninstalled` - Handle uninstalls

### Admin API (requires shop parameter)
- `GET /api/campaigns?shop=...` - List campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/mapping-rules` - Add mapping rule
- `GET /api/claims?shop=...` - List claims
- `POST /api/ig-connection` - Connect Instagram account

## 📊 Database Schema

- **shops**: Shopify stores with access tokens and IG connections
- **campaigns**: Drop campaigns with hold time settings
- **mapping_rules**: Trigger patterns → variant mappings
- **claims**: Each claim attempt with status tracking
- **reservations**: Inventory holds with expiration times

## 🔐 Security Notes

- Never commit `.env` file
- Use environment variables for all secrets
- Validate webhook signatures (Shopify HMAC, Meta signatures)
- Use HTTPS in production
- Implement rate limiting for public endpoints

## 🐛 Troubleshooting

**Claims not processing:**
- Check Instagram webhook is receiving events (Meta App Dashboard)
- Verify IG access token is valid
- Check campaign is active
- Ensure mapping rules exist for the trigger pattern

**Draft orders not creating:**
- Verify Shopify access token has correct scopes
- Check variant IDs are correct (numeric ID, not GID)
- Ensure inventory is available

**DMs not sending:**
- Verify 24-hour messaging window (Meta policy)
- Check IG access token permissions
- Review rate limits in Meta App Dashboard

## 📚 Documentation

See `__DOCS/` folder for:
- `shopify_instagram_prerequisites.md` - Detailed setup guide
- `shopify_developer_tasks.md` - Development roadmap
- `https___apps.shopify.com_claimbase.md` - Reference implementation

## 🚧 Roadmap

- [ ] AI-powered reply system
- [ ] Waitlist + restock notifications
- [ ] Multi-step DM flows
- [ ] Analytics dashboard
- [ ] Template framework for different verticals
- [ ] Live comment support
- [ ] Story reply triggers

## 📄 License

MIT

---

**Built with:** Node.js, TypeScript, Express, PostgreSQL, Redis, Shopify API, Instagram Graph API
