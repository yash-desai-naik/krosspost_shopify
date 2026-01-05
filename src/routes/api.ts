import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { Shop, Campaign, MappingRule, Claim } from '../types';
import { updateShopIGConnection } from '../services/shopify';

const router = Router();

router.get('/api/campaigns', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.query.shop as string;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    const shop = await queryOne<Shop>(
      'SELECT * FROM shops WHERE shopify_domain = $1',
      [shopDomain]
    );
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const campaigns = await query<Campaign>(
      'SELECT * FROM campaigns WHERE shop_id = $1 ORDER BY created_at DESC',
      [shop.id]
    );
    
    res.json({ campaigns });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/campaigns', async (req: Request, res: Response) => {
  try {
    const { shop: shopDomain, name, holdTimeMinutes, perPersonLimit } = req.body;
    
    if (!shopDomain || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const shop = await queryOne<Shop>(
      'SELECT * FROM shops WHERE shopify_domain = $1',
      [shopDomain]
    );
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const result = await query<Campaign>(
      `INSERT INTO campaigns (shop_id, name, hold_time_minutes, per_person_limit, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [shop.id, name, holdTimeMinutes || 15, perPersonLimit || null]
    );
    
    res.json({ campaign: result[0] });
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/mapping-rules', async (req: Request, res: Response) => {
  try {
    const { campaignId, strategy, triggerPattern, shopifyVariantId, sku, sequentialId } = req.body;
    
    if (!campaignId || !strategy || !triggerPattern) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await query<MappingRule>(
      `INSERT INTO mapping_rules (campaign_id, strategy, trigger_pattern, shopify_variant_id, sku, sequential_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [campaignId, strategy, triggerPattern, shopifyVariantId || null, sku || null, sequentialId || null]
    );
    
    res.json({ rule: result[0] });
  } catch (error: any) {
    console.error('Error creating mapping rule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api/campaigns/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    
    await query('DELETE FROM mapping_rules WHERE campaign_id = $1', [campaignId]);
    await query('DELETE FROM campaigns WHERE id = $1', [campaignId]);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api/mapping-rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    console.log('DELETE request for mapping rule:', ruleId);
    
    const result = await query('DELETE FROM mapping_rules WHERE id = $1 RETURNING *', [ruleId]);
    console.log('Delete result:', result);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Mapping rule not found' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting mapping rule:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/api/claims', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.query.shop as string;
    const campaignId = req.query.campaignId as string;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    const shop = await queryOne<Shop>(
      'SELECT * FROM shops WHERE shopify_domain = $1',
      [shopDomain]
    );
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    let claims: Claim[];
    
    if (campaignId) {
      claims = await query<Claim>(
        'SELECT * FROM claims WHERE shop_id = $1 AND campaign_id = $2 ORDER BY created_at DESC LIMIT 100',
        [shop.id, campaignId]
      );
    } else {
      claims = await query<Claim>(
        'SELECT * FROM claims WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 100',
        [shop.id]
      );
    }
    
    res.json({ claims });
  } catch (error: any) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/ig-connection', async (req: Request, res: Response) => {
  try {
    const { shopId, igAccountId, igAccessToken } = req.body;
    
    if (!shopId || !igAccountId || !igAccessToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await updateShopIGConnection(shopId, igAccountId, igAccessToken);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating IG connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/campaigns/:campaignId/mapping-rules', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    
    const rules = await query<MappingRule>(
      'SELECT * FROM mapping_rules WHERE campaign_id = $1',
      [campaignId]
    );
    
    res.json({ rules });
  } catch (error: any) {
    console.error('Error fetching mapping rules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/product-variants/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const shopDomain = req.query.shop as string;
    
    if (!shopDomain) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    const shop = await queryOne<Shop>(
      'SELECT * FROM shops WHERE shopify_domain = $1',
      [shopDomain]
    );
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const { getShopify, createSession } = require('../services/shopify');
    const shopifyApi = getShopify();
    const session = createSession(shop.shopifyDomain, shop.accessToken);
    const client = new shopifyApi.clients.Graphql({ session });
    
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryQuantity
              }
            }
          }
        }
      }
    `;
    
    const response = await client.query({
      data: {
        query,
        variables: { id: `gid://shopify/Product/${productId}` },
      },
    });
    
    const data = response.body as any;
    const product = data.data?.product;
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const variants = product.variants.edges.map((edge: any) => ({
      id: edge.node.id.split('/').pop(),
      title: edge.node.title,
      sku: edge.node.sku,
      price: edge.node.price,
      inventoryQuantity: edge.node.inventoryQuantity,
    }));
    
    res.json({ 
      product: {
        id: productId,
        title: product.title,
      },
      variants 
    });
  } catch (error: any) {
    console.error('Error fetching product variants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
