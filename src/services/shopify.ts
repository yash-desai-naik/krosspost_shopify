import { shopifyApi, LATEST_API_VERSION, Session, Shopify } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import { config } from '../config';
import { query, queryOne } from '../db';
import { Shop } from '../types';

let shopifyInstance: Shopify | null = null;

export function getShopify(): Shopify {
  if (!shopifyInstance) {
    shopifyInstance = shopifyApi({
      apiKey: config.shopify.apiKey,
      apiSecretKey: config.shopify.apiSecret,
      scopes: config.shopify.scopes.split(','),
      hostName: new URL(config.app.url).hostname,
      hostScheme: new URL(config.app.url).protocol.replace(':', '') as 'http' | 'https',
      apiVersion: LATEST_API_VERSION,
      isEmbeddedApp: true,
      isCustomStoreApp: false,
    });
  }
  return shopifyInstance;
}

export const shopify = getShopify();

export async function saveShop(shop: Omit<Shop, 'id' | 'installedAt' | 'updatedAt'>): Promise<Shop> {
  const result = await query<Shop>(
    `INSERT INTO shops (shopify_domain, access_token, scopes, ig_account_id, ig_access_token)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (shopify_domain) 
     DO UPDATE SET 
       access_token = EXCLUDED.access_token,
       scopes = EXCLUDED.scopes,
       updated_at = NOW()
     RETURNING *`,
    [shop.shopifyDomain, shop.accessToken, shop.scopes, shop.igAccountId || null, shop.igAccessToken || null]
  );
  
  return result[0];
}

export async function getShop(shopifyDomain: string): Promise<Shop | null> {
  return queryOne<Shop>(
    'SELECT * FROM shops WHERE shopify_domain = $1',
    [shopifyDomain]
  );
}

export async function deleteShop(shopifyDomain: string): Promise<void> {
  await query('DELETE FROM shops WHERE shopify_domain = $1', [shopifyDomain]);
}

export async function updateShopIGConnection(
  shopId: string,
  igAccountId: string,
  igAccessToken: string
): Promise<void> {
  await query(
    'UPDATE shops SET ig_account_id = $1, ig_access_token = $2, updated_at = NOW() WHERE id = $3',
    [igAccountId, igAccessToken, shopId]
  );
}

export function createSession(shop: string, accessToken: string): Session {
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: 'active',
    isOnline: false,
    accessToken,
  });
}

export async function createDraftOrder(
  shop: Shop,
  input: {
    variantId: string;
    quantity: number;
    customerId?: string;
    email?: string;
    note?: string;
  }
): Promise<{ draftOrderId: string; checkoutUrl: string }> {
  // Use direct checkout URL (no special permissions needed)
  // Format: https://SHOP.myshopify.com/cart/VARIANT_ID:QUANTITY
  const checkoutUrl = `https://${shop.shopifyDomain}/cart/${input.variantId}:${input.quantity}`;
  
  console.log('✅ Generated checkout URL:', checkoutUrl);
  
  // Return a pseudo draft order ID for tracking
  const draftOrderId = `checkout-${Date.now()}`;
  
  return { draftOrderId, checkoutUrl };
}

export async function getProductVariantBySKU(
  shop: Shop,
  sku: string
): Promise<{ variantId: string; inventoryQuantity: number } | null> {
  const shopifyApi = getShopify();
  const session = createSession(shop.shopifyDomain, shop.accessToken);
  const client = new shopifyApi.clients.Graphql({ session });
  
  const query = `
    query getVariantBySKU($query: String!) {
      productVariants(first: 1, query: $query) {
        edges {
          node {
            id
            inventoryQuantity
          }
        }
      }
    }
  `;
  
  const response = await client.query({
    data: {
      query,
      variables: { query: `sku:${sku}` },
    },
  });
  
  const data = response.body as any;
  const edges = data.data?.productVariants?.edges || [];
  
  if (edges.length === 0) {
    return null;
  }
  
  const variant = edges[0].node;
  
  return {
    variantId: variant.id.split('/').pop(),
    inventoryQuantity: variant.inventoryQuantity || 0,
  };
}

export async function getProductVariantById(
  shop: Shop,
  variantId: string
): Promise<{ variantId: string; inventoryQuantity: number } | null> {
  const shopifyApi = getShopify();
  const session = createSession(shop.shopifyDomain, shop.accessToken);
  const client = new shopifyApi.clients.Graphql({ session });
  
  const query = `
    query getVariantById($id: ID!) {
      productVariant(id: $id) {
        id
        inventoryQuantity
      }
    }
  `;
  
  // Shopify GraphQL expects format: gid://shopify/ProductVariant/44827746304047
  const gid = variantId.startsWith('gid://') 
    ? variantId 
    : `gid://shopify/ProductVariant/${variantId}`;
  
  const response = await client.query({
    data: {
      query,
      variables: { id: gid },
    },
  });
  
  const data = response.body as any;
  const variant = data.data?.productVariant;
  
  if (!variant) {
    console.log('❌ Variant not found:', variantId);
    return null;
  }
  
  console.log('✅ Variant found:', { id: variantId, inventoryQuantity: variant.inventoryQuantity });
  
  return {
    variantId: variant.id.split('/').pop(),
    inventoryQuantity: variant.inventoryQuantity || 0,
  };
}
