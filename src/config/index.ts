import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    url: process.env.APP_URL || 'http://localhost:3000',
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/krosspost_shopify',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY!,
    apiSecret: process.env.SHOPIFY_API_SECRET!,
    scopes: process.env.SHOPIFY_SCOPES || 'read_products,read_inventory,write_draft_orders,write_orders,read_customers,write_customers',
    authCallbackUrl: process.env.SHOPIFY_AUTH_CALLBACK_URL!,
    webhooksPath: process.env.SHOPIFY_WEBHOOKS_PATH || '/webhooks/shopify',
  },
  
  meta: {
    appId: process.env.META_APP_ID!,
    appSecret: process.env.META_APP_SECRET!,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN!,
    webhookPath: process.env.META_WEBHOOK_PATH || '/webhooks/meta',
    pageId: process.env.META_PAGE_ID,
    igBusinessAccountId: process.env.META_IG_BUSINESS_ACCOUNT_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export function validateConfig() {
  const required = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'META_APP_ID',
    'META_APP_SECRET',
    'META_WEBHOOK_VERIFY_TOKEN',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
