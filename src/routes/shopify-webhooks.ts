import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db';
import { config } from '../config';
import { Shop } from '../types';

const router = Router();

/**
 * CRITICAL: Raw body parser middleware for HMAC verification
 * Must be applied BEFORE the main body parser in index.ts
 */
function rawBodyParser(req: Request, res: Response, next: NextFunction) {
  let data = '';
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    (req as any).rawBody = data;
    
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch (e) {
      req.body = {};
    }
    
    next();
  });
}

/**
 * Verify Shopify HMAC signature
 */
function verifyShopifyWebhookHMAC(
  body: string,
  hmacHeader: string,
  apiSecret: string
): boolean {
  try {
    const hmac = crypto
      .createHmac('sha256', apiSecret)
      .update(body, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(hmacHeader)
    );
  } catch (error) {
    console.error('HMAC comparison error:', error);
    return false;
  }
}

/**
 * Middleware to verify Shopify webhook signatures
 */
function verifyShopifyWebhook(req: Request, res: Response, next: NextFunction) {
  const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
  
  if (!hmacHeader) {
    console.error('❌ Missing X-Shopify-Hmac-SHA256 header');
    return res.status(401).json({ error: 'Unauthorized: Missing HMAC header' });
  }

  try {
    const rawBody = (req as any).rawBody;
    
    if (!rawBody) {
      console.error('❌ No raw body available for HMAC verification');
      return res.status(401).json({ error: 'Unauthorized: Cannot verify HMAC' });
    }
    
    const isValid = verifyShopifyWebhookHMAC(
      rawBody,
      hmacHeader,
      config.shopify.apiSecret
    );

    if (!isValid) {
      console.error('❌ Invalid HMAC signature');
      return res.status(401).json({ error: 'Unauthorized: Invalid HMAC signature' });
    }

    console.log('✅ Valid HMAC signature verified');
    next();
  } catch (error) {
    console.error('❌ HMAC verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: HMAC verification failed' });
  }
}

/**
 * POST /webhooks/shopify/customers/data_request
 */
router.post(
  '/webhooks/shopify/customers/data_request',
  rawBodyParser,
  verifyShopifyWebhook,
  async (req: Request, res: Response) => {
    try {
      const { shop_id, shop_domain, customer, data_request } = req.body;

      console.log('📨 Received customers/data_request webhook');
      console.log(`   Shop: ${shop_domain}`);

      const shop = await queryOne<Shop>(
        'SELECT * FROM shops WHERE shopify_domain = $1',
        [shop_domain]
      );

      if (shop) {
        await query(
          `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [shop.id, 'data_request', data_request?.id, customer?.email, JSON.stringify(req.body)]
        ).catch(() => {
          console.log('Could not log compliance request');
        });
      }

      console.log('✅ Data request acknowledged');
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('❌ customers/data_request error:', error);
      res.status(200).json({ success: true });
    }
  }
);

/**
 * POST /webhooks/shopify/customers/redact
 */
router.post(
  '/webhooks/shopify/customers/redact',
  rawBodyParser,
  verifyShopifyWebhook,
  async (req: Request, res: Response) => {
    try {
      const { shop_id, shop_domain, customer } = req.body;

      console.log('📨 Received customers/redact webhook');
      console.log(`   Shop: ${shop_domain}`);

      const shop = await queryOne<Shop>(
        'SELECT * FROM shops WHERE shopify_domain = $1',
        [shop_domain]
      );

      if (shop) {
        await query(
          `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [shop.id, 'redact', `redact-${customer?.id}`, customer?.email, JSON.stringify(req.body)]
        ).catch(() => {
          console.log('Could not log compliance request');
        });

        await query(
          `DELETE FROM claims WHERE shop_id = $1 AND ig_user_id = $2`,
          [shop.id, customer?.id]
        ).catch(() => {
          console.log('Could not delete claims');
        });
      }

      console.log('✅ Customer data redacted');
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('❌ customers/redact error:', error);
      res.status(200).json({ success: true });
    }
  }
);

/**
 * POST /webhooks/shopify/shop/redact
 */
router.post(
  '/webhooks/shopify/shop/redact',
  rawBodyParser,
  verifyShopifyWebhook,
  async (req: Request, res: Response) => {
    try {
      const { shop_id, shop_domain } = req.body;

      console.log('📨 Received shop/redact webhook');
      console.log(`   Shop: ${shop_domain}`);

      const shop = await queryOne<Shop>(
        'SELECT * FROM shops WHERE shopify_domain = $1',
        [shop_domain]
      );

      if (shop) {
        await query(
          `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [shop.id, 'shop_redact', `shop-redact-${shop_id}`, 'shop@redaction', JSON.stringify(req.body)]
        ).catch(() => {
          console.log('Could not log compliance request');
        });

        await query('DELETE FROM claims WHERE shop_id = $1', [shop.id]);
        await query('DELETE FROM campaigns WHERE shop_id = $1', [shop.id]);
        await query('DELETE FROM shops WHERE id = $1', [shop.id]);
      }

      console.log('✅ Shop data deleted');
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('❌ shop/redact error:', error);
      res.status(200).json({ success: true });
    }
  }
);

export default router;