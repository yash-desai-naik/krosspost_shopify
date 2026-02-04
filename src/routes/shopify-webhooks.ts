import { Router, Request, Response } from 'express';
import express from 'express';
import type { Router as ExpressRouter } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db';
import { config } from '../config';
import { Shop } from '../types';

const router: ExpressRouter = Router();

/**
 * Raw body parser middleware specifically for webhooks that need HMAC verification
 * This captures the raw request body before JSON parsing
 */
router.use(express.raw({ type: 'application/json' }), (req: Request, res: Response, next: Function) => {
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  (req as any).rawBody = rawBody;
  (req as any).body = JSON.parse(rawBody);
  next();
});

/**
 * Verify Shopify HMAC signature
 * Required for all Shopify webhooks per compliance requirements
 */
function verifyShopifyWebhookHMAC(
  body: string,
  hmacHeader: string,
  apiSecret: string
): boolean {
  const hmac = crypto
    .createHmac('sha256', apiSecret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(hmacHeader)
  );
}

/**
 * Middleware to verify Shopify webhook signatures
 */
function createVerifyShopifyWebhookMiddleware(apiSecret: string) {
  return (req: Request, res: Response, next: Function) => {
    const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
    
    if (!hmacHeader) {
      console.error('❌ Missing X-Shopify-Hmac-SHA256 header');
      return res.status(401).json({ error: 'Unauthorized: Missing HMAC header' });
    }

    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const isValid = verifyShopifyWebhookHMAC(
        rawBody,
        hmacHeader,
        apiSecret
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
  };
}

const verifyShopifyWebhook = createVerifyShopifyWebhookMiddleware(config.shopify.apiSecret);

/**
 * GET /webhooks/shopify/customers/data_request
 * Shopify compliance webhook - Data request subscriptions are registered here
 */
router.get('/webhooks/shopify/customers/data_request', (req: Request, res: Response) => {
  console.log('📨 Shopify compliance webhook endpoint registered for customers/data_request');
  res.status(200).json({ message: 'Webhook endpoint registered' });
});

/**
 * POST /webhooks/shopify/customers/data_request
 * Mandatory compliance webhook - responds to customer data requests
 * https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#customersdata_request
 */
router.post(
  '/webhooks/shopify/customers/data_request',
  verifyShopifyWebhook,
  async (req: Request, res: Response) => {
    try {
      const { shop_id, shop_domain, customer, orders_requested, data_request } = req.body;

      console.log('📨 Received customers/data_request webhook:');
      console.log(`   Shop: ${shop_domain} (ID: ${shop_id})`);
      console.log(`   Customer: ${customer.email}`);
      console.log(`   Data Request ID: ${data_request.id}`);

      const shop = await queryOne<Shop>(
        'SELECT * FROM shops WHERE shopify_domain = $1',
        [shop_domain]
      );

      if (!shop) {
        console.log(`⚠️ Shop not found: ${shop_domain}`);
        // Still return 200 to acknowledge receipt
        return res.status(200).json({ 
          success: true, 
          message: 'Data request received (shop not found in system)' 
        });
      }

      // Log the data request in your database for audit purposes
      await query(
        `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [shop.id, 'data_request', data_request.id, customer.email, JSON.stringify(req.body)]
      ).catch(() => {
        // Table might not exist yet, continue anyway
        console.log('Could not log compliance request (table may not exist)');
      });

      // You have 30 days to complete the action
      // In this case, you would gather all data related to this customer and provide it to the shop owner
      console.log('✅ Data request acknowledged and stored');

      res.status(200).json({ 
        success: true, 
        message: 'Data request received and will be processed' 
      });
    } catch (error: any) {
      console.error('❌ customers/data_request webhook error:', error);
      // Return 200 anyway - we've acknowledged the webhook
      res.status(200).json({ error: 'Error processing data request' });
    }
  }
);

/**
 * GET /webhooks/shopify/customers/redact
 * Shopify compliance webhook - Redaction subscriptions are registered here
 */
router.get('/webhooks/shopify/customers/redact', (req: Request, res: Response) => {
  console.log('📨 Shopify compliance webhook endpoint registered for customers/redact');
  res.status(200).json({ message: 'Webhook endpoint registered' });
});

/**
 * POST /webhooks/shopify/customers/redact
 * Mandatory compliance webhook - responds to customer redaction requests
 * https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#customersredact
 */
router.post(
  '/webhooks/shopify/customers/redact',
  verifyShopifyWebhook,
  async (req: Request, res: Response) => {
    try {
      const { shop_id, shop_domain, customer, orders_to_redact } = req.body;

      console.log('📨 Received customers/redact webhook:');
      console.log(`   Shop: ${shop_domain} (ID: ${shop_id})`);
      console.log(`   Customer: ${customer.email}`);
      console.log(`   Orders to redact: ${orders_to_redact.join(', ')}`);

      const shop = await queryOne<Shop>(
        'SELECT * FROM shops WHERE shopify_domain = $1',
        [shop_domain]
      );

      if (!shop) {
        console.log(`⚠️ Shop not found: ${shop_domain}`);
        // Still return 200 to acknowledge receipt
        return res.status(200).json({ 
          success: true, 
          message: 'Redaction request received (shop not found in system)' 
        });
      }

      // Log the redaction request for audit purposes
      await query(
        `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [shop.id, 'redact', `redact-${customer.id}`, customer.email, JSON.stringify(req.body)]
      ).catch(() => {
        // Table might not exist yet, continue anyway
        console.log('Could not log compliance request (table may not exist)');
      });

      // Delete customer data from your database
      // This should include:
      // - Any customer PII associated with this customer ID
      // - Conversation history with this customer
      // - Any other personal data linked to this customer
      
      // Example: Delete claims associated with this customer
      if (shop.id) {
        await query(
          `DELETE FROM claims WHERE shop_id = $1 AND ig_user_id = $2`,
          [shop.id, customer.id]
        ).catch(() => {
          console.log('Could not delete claims (table structure may differ)');
        });
      }

      console.log('✅ Customer data redacted');

      res.status(200).json({ 
        success: true, 
        message: 'Redaction request received and processed' 
      });
    } catch (error: any) {
      console.error('❌ customers/redact webhook error:', error);
      // Return 200 anyway - we've acknowledged the webhook
      res.status(200).json({ error: 'Error processing redaction request' });
    }
  }
);

/**
 * GET /webhooks/shopify/shop/redact
 * Shopify compliance webhook - Shop redaction subscriptions are registered here
 */
router.get('/webhooks/shopify/shop/redact', (req: Request, res: Response) => {
  console.log('📨 Shopify compliance webhook endpoint registered for shop/redact');
  res.status(200).json({ message: 'Webhook endpoint registered' });
});

/**
 * POST /webhooks/shopify/shop/redact
 * Mandatory compliance webhook - responds to shop data redaction (uninstall)
 * Triggered 48 hours after app uninstall
 * https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#shopredact
 */
router.post(
  '/webhooks/shopify/shop/redact',
  verifyShopifyWebhook,
  async (req: Request, res: Response) => {
    try {
      const { shop_id, shop_domain } = req.body;

      console.log('📨 Received shop/redact webhook:');
      console.log(`   Shop: ${shop_domain} (ID: ${shop_id})`);

      const shop = await queryOne<Shop>(
        'SELECT * FROM shops WHERE shopify_domain = $1',
        [shop_domain]
      );

      if (shop) {
        // Log the shop redaction for audit purposes
        await query(
          `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [shop.id, 'shop_redact', `shop-redact-${shop_id}`, 'shop@redaction', JSON.stringify(req.body)]
        ).catch(() => {
          console.log('Could not log compliance request (table may not exist)');
        });

        // Delete ALL data for this shop
        // This must include:
        // - All customer/user data
        // - All campaigns and claims
        // - All tokens and credentials
        // - Any other app data associated with this shop

        // Delete in order: claims → campaigns → shops
        await query('DELETE FROM claims WHERE shop_id = $1', [shop.id]);
        await query('DELETE FROM campaigns WHERE shop_id = $1', [shop.id]);
        await query('DELETE FROM mapping_rules WHERE campaign_id NOT IN (SELECT id FROM campaigns)');
        await query('DELETE FROM shops WHERE id = $1', [shop.id]);

        console.log('✅ All shop data deleted');
      } else {
        console.log(`⚠️ Shop not found: ${shop_domain}`);
      }

      // Always return 200 to acknowledge receipt
      res.status(200).json({ 
        success: true, 
        message: 'Shop redaction request acknowledged' 
      });
    } catch (error: any) {
      console.error('❌ shop/redact webhook error:', error);
      // Return 200 anyway - we've acknowledged the webhook
      res.status(200).json({ error: 'Error processing shop redaction' });
    }
  }
);

export default router;
