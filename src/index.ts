import express from 'express';
import session from 'express-session';
import path from 'path';
import crypto from 'crypto';
import { config, validateConfig } from './config';
import { getPool, query, queryOne } from './db';
import shopifyAuthRoutes from './routes/shopify-auth';
import instagramWebhookRoutes from './routes/instagram-webhooks';
import instagramOAuthRoutes from './routes/instagram-oauth';
import apiRoutes from './routes/api';
import { startExpiryWorker, scheduleExpiryCheck } from './workers/expiry';
import { Shop } from './types';

validateConfig();

const app = express();

// Logging middleware FIRST
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// SHOPIFY COMPLIANCE WEBHOOKS - Inline registration for debugging
// ============================================================================

function verifyShopifyHMAC(body: string, hmacHeader: string): boolean {
  try {
    const hmac = crypto
      .createHmac('sha256', config.shopify.apiSecret)
      .update(body, 'utf8')
      .digest('base64');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

const rawBodySaver = express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
});

// POST /webhooks/shopify/customers/data_request
app.post('/webhooks/shopify/customers/data_request', rawBodySaver, async (req, res) => {
  console.log('🔵 HIT: customers/data_request');
  
  const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
  if (!hmacHeader) {
    console.log('❌ Missing HMAC');
    return res.status(401).json({ error: 'Missing HMAC' });
  }
  
  const rawBody = (req as any).rawBody;
  if (!rawBody || !verifyShopifyHMAC(rawBody, hmacHeader)) {
    console.log('❌ Invalid HMAC');
    return res.status(401).json({ error: 'Invalid HMAC' });
  }
  
  console.log('✅ Valid HMAC - Processing data request');
  
  try {
    const { shop_domain, customer, data_request } = req.body;
    const shop = await queryOne<Shop>('SELECT * FROM shops WHERE shopify_domain = $1', [shop_domain]);
    
    if (shop) {
      await query(
        `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [shop.id, 'data_request', data_request?.id || 'unknown', customer?.email || 'unknown', JSON.stringify(req.body)]
      ).catch(() => console.log('Could not log compliance request'));
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(200).json({ success: true });
  }
});

// POST /webhooks/shopify/customers/redact
app.post('/webhooks/shopify/customers/redact', rawBodySaver, async (req, res) => {
  console.log('🔵 HIT: customers/redact');
  
  const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
  if (!hmacHeader) {
    return res.status(401).json({ error: 'Missing HMAC' });
  }
  
  const rawBody = (req as any).rawBody;
  if (!rawBody || !verifyShopifyHMAC(rawBody, hmacHeader)) {
    return res.status(401).json({ error: 'Invalid HMAC' });
  }
  
  try {
    const { shop_domain, customer } = req.body;
    const shop = await queryOne<Shop>('SELECT * FROM shops WHERE shopify_domain = $1', [shop_domain]);
    
    if (shop) {
      await query(
        `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [shop.id, 'redact', `redact-${customer?.id}`, customer?.email || 'unknown', JSON.stringify(req.body)]
      ).catch(() => {});
      
      await query('DELETE FROM claims WHERE shop_id = $1 AND ig_user_id = $2', [shop.id, customer?.id]).catch(() => {});
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(200).json({ success: true });
  }
});

// POST /webhooks/shopify/shop/redact
app.post('/webhooks/shopify/shop/redact', rawBodySaver, async (req, res) => {
  console.log('🔵 HIT: shop/redact');
  
  const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
  if (!hmacHeader) {
    return res.status(401).json({ error: 'Missing HMAC' });
  }
  
  const rawBody = (req as any).rawBody;
  if (!rawBody || !verifyShopifyHMAC(rawBody, hmacHeader)) {
    return res.status(401).json({ error: 'Invalid HMAC' });
  }
  
  try {
    const { shop_id, shop_domain } = req.body;
    const shop = await queryOne<Shop>('SELECT * FROM shops WHERE shopify_domain = $1', [shop_domain]);
    
    if (shop) {
      await query(
        `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [shop.id, 'shop_redact', `shop-redact-${shop_id}`, 'shop@redaction', JSON.stringify(req.body)]
      ).catch(() => {});
      
      await query('DELETE FROM claims WHERE shop_id = $1', [shop.id]);
      await query('DELETE FROM campaigns WHERE shop_id = $1', [shop.id]);
      await query('DELETE FROM shops WHERE id = $1', [shop.id]);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(200).json({ success: true });
  }
});

// ============================================================================
// END COMPLIANCE WEBHOOKS
// ============================================================================

// Body parsing for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.use(
  session({
    secret: config.app.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.app.env === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(shopifyAuthRoutes);
app.use(instagramWebhookRoutes);
app.use(instagramOAuthRoutes);
app.use(apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('Krosspost Shopify App - Instagram Claims to Draft Orders');
});

async function start() {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    console.log('✓ Database connected');
    
    try {
      startExpiryWorker();
      await Promise.race([
        scheduleExpiryCheck(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 5000))
      ]);
      console.log('✓ Background workers started');
    } catch (error) {
      console.warn('⚠ Background workers failed to start:', error instanceof Error ? error.message : error);
    }
    
    app.listen(config.app.port, () => {
      console.log(`✓ Server running on ${config.app.url}`);
      console.log(`  - Shopify OAuth: ${config.app.url}/auth/shopify`);
      console.log(`  - Shopify Compliance Webhooks (INLINE):`);
      console.log(`    • POST ${config.app.url}/webhooks/shopify/customers/data_request`);
      console.log(`    • POST ${config.app.url}/webhooks/shopify/customers/redact`);
      console.log(`    • POST ${config.app.url}/webhooks/shopify/shop/redact`);
      console.log(`  - Meta Webhooks: ${config.app.url}${config.meta.webhookPath}`);
      console.log('\n🎯 Compliance webhooks registered INLINE (not via router)');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();