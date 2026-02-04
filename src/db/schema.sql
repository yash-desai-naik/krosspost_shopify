-- Shops table (Shopify stores)
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_domain VARCHAR(255) UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  scopes TEXT NOT NULL,
  ig_account_id VARCHAR(255),
  ig_access_token TEXT,
  installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shops_shopify_domain ON shops(shopify_domain);

-- Campaigns table (optional grouping for drops/live events)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  hold_time_minutes INTEGER NOT NULL DEFAULT 15,
  per_person_limit INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_shop_id ON campaigns(shop_id);
CREATE INDEX idx_campaigns_is_active ON campaigns(is_active);

-- Mapping rules (trigger patterns -> product/variant)
CREATE TABLE IF NOT EXISTS mapping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  strategy VARCHAR(50) NOT NULL,
  trigger_pattern VARCHAR(255) NOT NULL,
  shopify_variant_id VARCHAR(255),
  shopify_product_id VARCHAR(255),
  sku VARCHAR(255),
  sequential_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mapping_rules_campaign_id ON mapping_rules(campaign_id);
CREATE INDEX idx_mapping_rules_strategy ON mapping_rules(strategy);

-- Claims table (each claim attempt)
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  ig_user_id VARCHAR(255) NOT NULL,
  ig_username VARCHAR(255),
  ig_message_id VARCHAR(255) NOT NULL,
  raw_message TEXT NOT NULL,
  parsed_intent JSONB,
  matched_variant_id VARCHAR(255),
  shopify_draft_order_id VARCHAR(255),
  checkout_url TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_shop_id ON claims(shop_id);
CREATE INDEX idx_claims_campaign_id ON claims(campaign_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_ig_user_id ON claims(ig_user_id);
CREATE INDEX idx_claims_expires_at ON claims(expires_at);

-- Reservations table (inventory holds)
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  variant_id VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMP NOT NULL,
  released BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservations_claim_id ON reservations(claim_id);
CREATE INDEX idx_reservations_variant_id ON reservations(variant_id);
CREATE INDEX idx_reservations_expires_at ON reservations(expires_at);
CREATE INDEX idx_reservations_released ON reservations(released);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Compliance requests table (audit trail for GDPR/CPRA requests)
CREATE TABLE IF NOT EXISTS compliance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL,
  shopify_request_id VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  request_data JSONB NOT NULL,
  processed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_requests_shop_id ON compliance_requests(shop_id);
CREATE INDEX idx_compliance_requests_request_type ON compliance_requests(request_type);
CREATE INDEX idx_compliance_requests_created_at ON compliance_requests(created_at);