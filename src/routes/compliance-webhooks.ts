import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { query, queryOne } from '../db';
import { Shop } from '../types';

const router: Router = Router();

/**
 * HMAC verification function
 */
function verifyShopifyHMAC(body: string, hmacHeader: string): boolean {
  try {
    const hmac = crypto
      .createHmac('sha256', config.shopify.apiSecret)
      .update(body, 'utf8')
      .digest('base64');
    
    console.log('HMAC Verification:', {
      bodyLength: body.length,
      generatedHmac: hmac.substring(0, 10) + '...',
      receivedHmac: hmacHeader.substring(0, 10) + '...',
      match: hmac === hmacHeader
    });
    
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hmacHeader));
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

/**
 * Raw body capture middleware
 */
const rawBodySaver = express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
});

/**
 * Unified compliance webhook handler
 * Handles all three GDPR compliance topics:
 * - customers/data_request
 * - customers/redact
 * - shop/redact
 */
router.post('/webhooks/shopify/compliance', rawBodySaver, async (req: Request, res: Response) => {
  const topic = req.get('X-Shopify-Topic');
  console.log(`🔵 HIT: Compliance webhook - Topic: ${topic}`);
  
  // Verify HMAC
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
  
  console.log('✅ Valid HMAC - Processing compliance webhook');
  
  try {
    switch (topic) {
      case 'customers/data_request':
        await handleCustomersDataRequest(req.body);
        break;
      
      case 'customers/redact':
        await handleCustomersRedact(req.body);
        break;
      
      case 'shop/redact':
        await handleShopRedact(req.body);
        break;
      
      default:
        console.warn(`⚠️ Unknown compliance topic: ${topic}`);
        return res.status(404).json({ error: 'Unknown topic' });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing compliance webhook:', error);
    // Still return 200 to acknowledge receipt
    return res.status(200).json({ success: true });
  }
});

/**
 * HEAD handler for health checks
 */
router.head('/webhooks/shopify/compliance', (req: Request, res: Response) => {
  console.log('🔵 HEAD: Compliance webhook health check');
  res.status(200).end();
});

/**
 * Handle customers/data_request
 */
async function handleCustomersDataRequest(payload: any) {
  console.log('📋 Processing customers/data_request');
  
  const { shop_domain, customer, data_request } = payload;
  const shop = await queryOne<Shop>('SELECT * FROM shops WHERE shopify_domain = $1', [shop_domain]);
  
  if (shop) {
    await query(
      `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        shop.id,
        'data_request',
        data_request?.id || 'unknown',
        customer?.email || 'unknown',
        JSON.stringify(payload)
      ]
    ).catch((err) => console.log('Could not log compliance request:', err));
    
    console.log(`✅ Logged data request for customer: ${customer?.email}`);
  } else {
    console.log(`⚠️ Shop not found: ${shop_domain}`);
  }
}

/**
 * Handle customers/redact
 */
async function handleCustomersRedact(payload: any) {
  console.log('🗑️ Processing customers/redact');
  
  const { shop_domain, customer } = payload;
  const shop = await queryOne<Shop>('SELECT * FROM shops WHERE shopify_domain = $1', [shop_domain]);
  
  if (shop) {
    // Log the redaction request
    await query(
      `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        shop.id,
        'redact',
        `redact-${customer?.id}`,
        customer?.email || 'unknown',
        JSON.stringify(payload)
      ]
    ).catch(() => {});
    
    // Delete customer-related claims
    await query(
      'DELETE FROM claims WHERE shop_id = $1 AND ig_user_id = $2',
      [shop.id, customer?.id]
    ).catch(() => {});
    
    console.log(`✅ Redacted data for customer: ${customer?.email}`);
  } else {
    console.log(`⚠️ Shop not found: ${shop_domain}`);
  }
}

/**
 * Handle shop/redact
 */
async function handleShopRedact(payload: any) {
  console.log('🏪 Processing shop/redact');
  
  const { shop_id, shop_domain } = payload;
  const shop = await queryOne<Shop>('SELECT * FROM shops WHERE shopify_domain = $1', [shop_domain]);
  
  if (shop) {
    // Log the shop redaction
    await query(
      `INSERT INTO compliance_requests (shop_id, request_type, shopify_request_id, customer_email, request_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        shop.id,
        'shop_redact',
        `shop-redact-${shop_id}`,
        'shop@redaction',
        JSON.stringify(payload)
      ]
    ).catch(() => {});
    
    // Delete all shop data
    await query('DELETE FROM claims WHERE shop_id = $1', [shop.id]);
    await query('DELETE FROM campaigns WHERE shop_id = $1', [shop.id]);
    await query('DELETE FROM mapping_rules WHERE shop_id = $1', [shop.id]);
    await query('DELETE FROM reservations WHERE shop_id = $1', [shop.id]);
    await query('DELETE FROM shops WHERE id = $1', [shop.id]);
    
    console.log(`✅ Redacted all data for shop: ${shop_domain}`);
  } else {
    console.log(`⚠️ Shop not found: ${shop_domain}`);
  }
}

export default router;
