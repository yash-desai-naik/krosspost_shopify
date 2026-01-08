import { query, queryOne, transaction } from '../db';
import { 
  Claim, 
  ClaimStatus, 
  TriggerChannel, 
  ParsedClaimIntent, 
  MappingStrategy,
  MappingRule,
  Reservation,
  Shop,
  Campaign
} from '../types';
import { createDraftOrder, getProductVariantById } from './shopify';
import { sendInstagramDM } from './instagram';

export async function createClaim(data: {
  shopId: string;
  campaignId?: string;
  channel: TriggerChannel;
  igUserId: string;
  igUsername?: string;
  igMessageId: string;
  rawMessage: string;
}): Promise<Claim> {
  const result = await query<Claim>(
    `INSERT INTO claims (
      shop_id, campaign_id, status, channel, ig_user_id, ig_username, ig_message_id, raw_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      data.shopId,
      data.campaignId || null,
      ClaimStatus.NEW,
      data.channel,
      data.igUserId,
      data.igUsername || null,
      data.igMessageId,
      data.rawMessage,
    ]
  );
  
  return result[0];
}

export async function updateClaimStatus(
  claimId: string,
  status: ClaimStatus,
  updates?: Partial<Claim>
): Promise<void> {
  const fields: string[] = ['status = $2', 'updated_at = NOW()'];
  const values: any[] = [claimId, status];
  let paramIndex = 3;
  
  if (updates?.parsedIntent) {
    fields.push(`parsed_intent = $${paramIndex++}`);
    values.push(JSON.stringify(updates.parsedIntent));
  }
  
  if (updates?.matchedVariantId) {
    fields.push(`matched_variant_id = $${paramIndex++}`);
    values.push(updates.matchedVariantId);
  }
  
  if (updates?.shopifyDraftOrderId) {
    fields.push(`shopify_draft_order_id = $${paramIndex++}`);
    values.push(updates.shopifyDraftOrderId);
  }
  
  if (updates?.checkoutUrl) {
    fields.push(`checkout_url = $${paramIndex++}`);
    values.push(updates.checkoutUrl);
  }
  
  if (updates?.expiresAt) {
    fields.push(`expires_at = $${paramIndex++}`);
    values.push(updates.expiresAt);
  }
  
  await query(
    `UPDATE claims SET ${fields.join(', ')} WHERE id = $1`,
    values
  );
}

export function parseClaimMessage(message: string): ParsedClaimIntent | null {
  const normalized = message.trim().toLowerCase();
  
  const patterns = [
    // With "claim/sold/buy" prefix
    { regex: /^(?:sold|claim|buy)\s+#?(\d+)$/i, strategy: MappingStrategy.SEQUENTIAL_ID },
    { regex: /^(?:sold|claim|buy)\s+([a-z0-9-]+)$/i, strategy: MappingStrategy.SKU },
    { regex: /^(?:sold|claim|buy)\s+([a-z0-9]+)$/i, strategy: MappingStrategy.KEYWORD },
    // Without prefix - standalone patterns
    { regex: /^#?(\d+)$/i, strategy: MappingStrategy.SEQUENTIAL_ID },
    { regex: /^([a-z0-9]+)$/i, strategy: MappingStrategy.KEYWORD }, // Matches single words like "drop2"
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);
    if (match) {
      return {
        strategy: pattern.strategy,
        identifier: pattern.strategy === MappingStrategy.SEQUENTIAL_ID 
          ? parseInt(match[1], 10) 
          : match[1],
        quantity: 1,
      };
    }
  }
  
  return null;
}

export async function getMappingRules(campaignId: string): Promise<MappingRule[]> {
  return query<MappingRule>(
    'SELECT * FROM mapping_rules WHERE campaign_id = $1',
    [campaignId]
  );
}

export async function findMatchingVariant(
  intent: ParsedClaimIntent,
  rules: MappingRule[]
): Promise<string | null> {
  console.log('Finding variant for intent:', intent);
  console.log('Available rules:', rules.length);
  
  for (const rule of rules) {
    // Handle both camelCase and snake_case from database
    const variantId = (rule as any).shopifyVariantId || (rule as any).shopify_variant_id;
    const sequentialId = (rule as any).sequentialId || (rule as any).sequential_id;
    const triggerPattern = (rule as any).triggerPattern || (rule as any).trigger_pattern;
    
    console.log('Checking rule:', { strategy: rule.strategy, sku: rule.sku, variantId });
    
    if (rule.strategy !== intent.strategy) {
      console.log('Strategy mismatch:', rule.strategy, '!==', intent.strategy);
      continue;
    }
    
    if (intent.strategy === MappingStrategy.SEQUENTIAL_ID && sequentialId === intent.identifier) {
      console.log('✅ Matched by sequential ID');
      return variantId || null;
    }
    
    if (intent.strategy === MappingStrategy.SKU && rule.sku?.toLowerCase() === intent.identifier.toString().toLowerCase()) {
      console.log('✅ Matched by SKU');
      return variantId || null;
    }
    
    if (intent.strategy === MappingStrategy.KEYWORD && triggerPattern?.toLowerCase() === intent.identifier.toString().toLowerCase()) {
      console.log('✅ Matched by keyword');
      return variantId || null;
    }
  }
  
  console.log('❌ No matching rule found');
  return null;
}

export async function createReservation(
  claimId: string,
  variantId: string,
  quantity: number,
  holdTimeMinutes: number
): Promise<Reservation> {
  const expiresAt = new Date(Date.now() + holdTimeMinutes * 60 * 1000);
  
  const result = await query<Reservation>(
    `INSERT INTO reservations (claim_id, variant_id, quantity, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [claimId, variantId, quantity, expiresAt]
  );
  
  return result[0];
}

export async function processClaim(claimId: string): Promise<void> {
  await transaction(async (client) => {
    const claim = await queryOne<any>(
      'SELECT * FROM claims WHERE id = $1',
      [claimId]
    );
    
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }
    
    // Database returns snake_case, handle both camelCase and snake_case
    const rawMessage = claim.rawMessage || claim.raw_message;
    console.log('Processing claim with raw message:', rawMessage);
    
    const parsedIntent = parseClaimMessage(rawMessage);
    console.log('Parsed intent:', parsedIntent);
    
    if (!parsedIntent) {
      console.log('❌ Failed to parse message');
      await updateClaimStatus(claimId, ClaimStatus.FAILED_PARSE);
      return;
    }
    
    await updateClaimStatus(claimId, ClaimStatus.MATCHED, { 
      parsedIntent: parsedIntent as any 
    });
    
    const campaignId = claim.campaignId || claim.campaign_id;
    
    if (!campaignId) {
      console.log('❌ No campaign ID for claim');
      await updateClaimStatus(claimId, ClaimStatus.FAILED_PARSE);
      return;
    }
    
    console.log('Getting mapping rules for campaign:', campaignId);
    const rules = await getMappingRules(campaignId);
    console.log('Found rules:', rules);
    
    const variantId = await findMatchingVariant(parsedIntent, rules);
    
    if (!variantId) {
      await updateClaimStatus(claimId, ClaimStatus.FAILED_PARSE);
      return;
    }
    
    const shopId = claim.shopId || claim.shop_id;
    const shop = await queryOne<Shop>('SELECT * FROM shops WHERE id = $1', [shopId]);
    
    if (!shop) {
      throw new Error(`Shop ${shopId} not found`);
    }
    
    console.log('Shop record:', { 
      id: shop.id, 
      domain: shop.shopifyDomain || (shop as any).shopify_domain,
      hasAccessToken: !!(shop.accessToken || (shop as any).access_token)
    });
    
    // Handle snake_case from database
    const shopWithToken = {
      ...shop,
      shopifyDomain: shop.shopifyDomain || (shop as any).shopify_domain,
      accessToken: shop.accessToken || (shop as any).access_token,
      igAccessToken: shop.igAccessToken || (shop as any).ig_access_token
    };
    
    const variant = await getProductVariantById(shopWithToken, variantId);
    
    if (!variant || variant.inventoryQuantity < 1) {
      await updateClaimStatus(claimId, ClaimStatus.OUT_OF_STOCK, { matchedVariantId: variantId });
      return;
    }
    
    const campaign = await queryOne<Campaign>(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaignId]
    );
    
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    
    const { draftOrderId, checkoutUrl } = await createDraftOrder(shopWithToken, {
      variantId,
      quantity: parsedIntent.quantity || 1,
      note: `Instagram claim from @${claim.igUsername || claim.igUserId}`,
    });
    
    const holdTimeMinutes = (campaign as any).holdTimeMinutes || (campaign as any).hold_time_minutes || 15;
    const expiresAt = new Date(Date.now() + holdTimeMinutes * 60 * 1000);
    
    await updateClaimStatus(claimId, ClaimStatus.RESERVED, {
      matchedVariantId: variantId,
      shopifyDraftOrderId: draftOrderId,
      checkoutUrl,
      expiresAt,
    });
    
    await createReservation(
      claimId,
      variantId,
      parsedIntent.quantity || 1,
      holdTimeMinutes
    );
    
    // Send automated Instagram DM
    const igUserId = claim.igUserId || (claim as any).ig_user_id;
    const igAccessToken = shopWithToken.igAccessToken;
    const igAccountId = (shop as any).ig_account_id || shop.igAccountId;
    
    if (igAccessToken && igAccountId) {
      try {
        const message = `✅ Item reserved! Complete your purchase here: ${checkoutUrl}\n\n⏰ Link expires in ${holdTimeMinutes} minutes.`;
        
        await sendInstagramDM(
          igAccountId,
          igUserId,
          message,
          igAccessToken
        );
        
        console.log('✅ Instagram DM sent successfully');
        await updateClaimStatus(claimId, ClaimStatus.LINK_SENT);
      } catch (error) {
        console.error('Failed to send DM, but claim is still reserved:', error);
        await updateClaimStatus(claimId, ClaimStatus.RESERVED);
      }
    } else {
      // Fallback: Log checkout URL for manual sending
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ CHECKOUT URL READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 Instagram User:', igUserId);
      console.log('🔗 Checkout URL:', checkoutUrl);
      console.log('⏰ Expires in:', holdTimeMinutes, 'minutes');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 Instagram not connected. Copy URL and send manually');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      await updateClaimStatus(claimId, ClaimStatus.RESERVED);
    }
  });
}

export async function expireReservations(): Promise<void> {
  const expiredReservations = await query<Reservation>(
    `SELECT r.*, c.id as claim_id 
     FROM reservations r
     JOIN claims c ON c.id = r.claim_id
     WHERE r.expires_at < NOW() AND r.released = false`
  );
  
  for (const reservation of expiredReservations) {
    await query(
      'UPDATE reservations SET released = true WHERE id = $1',
      [reservation.id]
    );
    
    await updateClaimStatus(reservation.claimId, ClaimStatus.EXPIRED);
  }
}
