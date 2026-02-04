import express from 'express';
import session from 'express-session';
import path from 'path';
import { config, validateConfig } from './config';
import { getPool } from './db';
import shopifyAuthRoutes from './routes/shopify-auth';
import shopifyWebhooksRoutes from './routes/shopify-webhooks';
import instagramWebhookRoutes from './routes/instagram-webhooks';
import instagramOAuthRoutes from './routes/instagram-oauth';
import apiRoutes from './routes/api';
import { startExpiryWorker, scheduleExpiryCheck } from './workers/expiry';

validateConfig();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  if (req.path.includes('webhook')) {
    console.log('Webhook request detected:', {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
    });
  }
  next();
});

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
app.use(shopifyWebhooksRoutes);
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
      console.warn('  App will continue without background job processing');
    }
    
    app.listen(config.app.port, () => {
      console.log(`✓ Server running on ${config.app.url}`);
      console.log(`  - Shopify OAuth: ${config.app.url}/auth/shopify`);
      console.log(`  - Shopify Compliance Webhooks:`);
      console.log(`    • customers/data_request: ${config.app.url}/webhooks/shopify/customers/data_request`);
      console.log(`    • customers/redact: ${config.app.url}/webhooks/shopify/customers/redact`);
      console.log(`    • shop/redact: ${config.app.url}/webhooks/shopify/shop/redact`);
      console.log(`  - Meta Webhooks: ${config.app.url}${config.meta.webhookPath}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
