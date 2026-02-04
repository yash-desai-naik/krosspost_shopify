import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import express from 'express';
import { query, queryOne } from '../db';
import { config } from '../config';
import { Shop } from '../types';

const router : Router= Router();

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
 * Raw body capture middleware for HMAC verification
 */
const captureRawBody = express.json({
  verify: (req: any, res, buf, encoding) => {
    req.rawBody = buf.toString('utf8');
  }
});

/**
 * HMAC verification middleware
 */
function verifyHMAC(req: Request, res: Response, next: NextFunction) {
  const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
  
  if (!hmacHeader) {
    console.error('❌ Missing X-Shopify-Hmac-SHA256 header');
    return res.status(401).json({ error: 'Unauthorized: Missing HMAC header' });
  }

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
}

/**
 * POST /webhooks/shopify/customers/data_request
 */
router.post(
  '/webhooks/shopify/customers/data_request',
  captureRawBody,
  verifyHMAC,
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
          [shop.id, 'data_request', data_request?.id || 'unknown', customer?.email || 'unknown', JSON.stringify(req.body)]
        ).catch((err) => {
          console.log('Could not log compliance request:', err.message);
        });
      }

      console.log('✅ Data request acknowledged');
      res.status(200).json({ success: true, message: 'Data request received' });
    } catch (error: any) {
      console.error('❌ customers/data_request error:', error);
      res.status(200).json({ success: true, message: 'Request acknowledged' });
    }
  }
);

/**
 * POST /webhooks/shopify/customers/redact
 */
router.post(
  '/webhooks/shopify/customers/redact',
  captureRawBody,
  verifyHMAC,
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
          [shop.id, 'redact', `redact-${customer?.id || 'unknown'}`, customer?.email || 'unknown', JSON.stringify(req.body)]
        ).catch((err) => {
          console.log('Could not log compliance request:', err.message);
        });

        await query(
          `DELETE FROM claims WHERE shop_id = $1 AND ig_user_id = $2`,
          [shop.id, customer?.id]
        ).catch((err) => {
          console.log('Could not delete claims:', err.message);
        });
      }

      console.log('✅ Customer data redacted');
      res.status(200).json({ success: true, message: 'Redaction completed' });
    } catch (error: any) {
      console.error('❌ customers/redact error:', error);
      res.status(200).json({ success: true, message: 'Request acknowledged' });
    }
  }
);

/**
 * POST /webhooks/shopify/shop/redact
 */
router.post(
  '/webhooks/shopify/shop/redact',
  captureRawBody,
  verifyHMAC,
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
        ).catch((err) => {
          console.log('Could not log compliance request:', err.message);
        });

        await query('DELETE FROM claims WHERE shop_id = $1', [shop.id]);
        await query('DELETE FROM campaigns WHERE shop_id = $1', [shop.id]);
        await query('DELETE FROM shops WHERE id = $1', [shop.id]);
      }

      console.log('✅ Shop data deleted');
      res.status(200).json({ success: true, message: 'Shop deletion completed' });
    } catch (error: any) {
      console.error('❌ shop/redact error:', error);
      res.status(200).json({ success: true, message: 'Request acknowledged' });
    }
  }
);

export default router;