#!/bin/bash

# Shopify Webhook Registration Script
# This script registers the mandatory compliance webhooks with your Shopify app

echo "🔧 Shopify Compliance Webhooks Registration"
echo "============================================"
echo ""

# Check if Shopify CLI is installed
if ! command -v shopify &> /dev/null; then
    echo "❌ Shopify CLI not found. Installing..."
    npm install -g @shopify/cli
fi

echo "📝 Before proceeding, you need to:"
echo "1. Get your production domain (e.g., krosspost.onrender.com)"
echo "2. Update shopify.app.toml with your domain"
echo "3. Make sure you're authenticated with Shopify CLI"
echo ""
read -p "Enter your production domain (without https://): " APP_DOMAIN

if [ -z "$APP_DOMAIN" ]; then
    echo "❌ Domain cannot be empty"
    exit 1
fi

# Update shopify.app.toml with the domain
echo "📝 Updating shopify.app.toml with domain: $APP_DOMAIN"
sed -i.bak "s|https://YOUR_APP_DOMAIN|https://$APP_DOMAIN|g" shopify.app.toml
rm shopify.app.toml.bak

echo "✓ shopify.app.toml updated"
echo ""

# Authenticate with Shopify
echo "🔐 Authenticating with Shopify..."
shopify auth login

echo ""
echo "📡 Registering compliance webhooks..."
echo ""

# Trigger webhooks to register them
echo "Registering customers/data_request..."
shopify app webhook trigger --topic customers/data_request

echo ""
echo "Registering customers/redact..."
shopify app webhook trigger --topic customers/redact

echo ""
echo "Registering shop/redact..."
shopify app webhook trigger --topic shop/redact

echo ""
echo "============================================"
echo "✅ Webhooks registration complete!"
echo ""
echo "Next steps:"
echo "1. Go to Shopify Admin: Settings > Apps and integrations > Webhooks"
echo "2. Verify all three webhooks are listed:"
echo "   - customers/data_request"
echo "   - customers/redact"
echo "   - shop/redact"
echo "3. Click 'Run' on the app review checklist again"
echo ""
echo "If webhooks don't appear:"
echo "- Verify your APP_URL environment variable is correct"
echo "- Ensure your domain has a valid SSL certificate"
echo "- Test endpoint accessibility: curl https://$APP_DOMAIN/webhooks/shopify/customers/data_request"
