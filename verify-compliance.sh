#!/bin/bash

# Shopify App Compliance Verification Script
# This script verifies that all compliance webhooks are properly implemented

echo "🔍 Shopify Privacy Compliance Webhook Verification"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Files exist
echo "1️⃣  Checking required files..."
files=(
  "src/routes/shopify-webhooks.ts"
  "shopify.app.toml"
  "COMPLIANCE_WEBHOOKS.md"
  "DEPLOYMENT_CHECKLIST.md"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file (MISSING)"
  fi
done

echo ""

# Check 2: Code contains required functions
echo "2️⃣  Checking code implementation..."

if grep -q "verifyShopifyWebhookHMAC" src/routes/shopify-webhooks.ts; then
  echo -e "${GREEN}✓${NC} HMAC verification function found"
else
  echo -e "${RED}✗${NC} HMAC verification function missing"
fi

if grep -q "customers/data_request" src/routes/shopify-webhooks.ts; then
  echo -e "${GREEN}✓${NC} customers/data_request endpoint found"
else
  echo -e "${RED}✗${NC} customers/data_request endpoint missing"
fi

if grep -q "customers/redact" src/routes/shopify-webhakes.ts; then
  echo -e "${GREEN}✓${NC} customers/redact endpoint found"
else
  echo -e "${RED}✗${NC} customers/redact endpoint missing"
fi

if grep -q "shop/redact" src/routes/shopify-webhooks.ts; then
  echo -e "${GREEN}✓${NC} shop/redact endpoint found"
else
  echo -e "${RED}✗${NC} shop/redact endpoint missing"
fi

echo ""

# Check 3: Database schema
echo "3️⃣  Checking database schema..."

if grep -q "compliance_requests" src/db/schema.sql; then
  echo -e "${GREEN}✓${NC} compliance_requests table in schema"
else
  echo -e "${RED}✗${NC} compliance_requests table missing from schema"
fi

if grep -q "request_type VARCHAR" src/db/schema.sql; then
  echo -e "${GREEN}✓${NC} request_type column defined"
else
  echo -e "${RED}✗${NC} request_type column missing"
fi

echo ""

# Check 4: Router integration
echo "4️⃣  Checking main app integration..."

if grep -q "shopifyWebhooksRoutes" src/index.ts; then
  echo -e "${GREEN}✓${NC} shopify-webhooks router imported"
else
  echo -e "${RED}✗${NC} shopify-webhooks router not imported"
fi

if grep -q "app.use(shopifyWebhooksRoutes)" src/index.ts; then
  echo -e "${GREEN}✓${NC} shopify-webhooks router registered"
else
  echo -e "${RED}✗${NC} shopify-webhooks router not registered"
fi

echo ""
echo "=================================================="
echo "✅ Verification Complete!"
echo ""
echo "Next steps:"
echo "1. Run database migration: npm run db:migrate"
echo "2. Build and test locally: npm run build && npm run dev"
echo "3. Test with ngrok for local development"
echo "4. Deploy to production"
echo "5. Submit app for Shopify review"
echo ""
echo "📖 For more details, see DEPLOYMENT_CHECKLIST.md"
