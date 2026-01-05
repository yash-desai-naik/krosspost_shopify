export enum ClaimStatus {
  NEW = 'new',
  MATCHED = 'matched',
  RESERVED = 'reserved',
  LINK_SENT = 'link_sent',
  PAID = 'paid',
  FAILED_PARSE = 'failed_parse',
  OUT_OF_STOCK = 'out_of_stock',
  EXPIRED = 'expired',
  CANCELED = 'canceled',
  WAITLIST = 'waitlist',
}

export enum TriggerChannel {
  COMMENT = 'comment',
  DM = 'dm',
  STORY_REPLY = 'story_reply',
  LIVE_COMMENT = 'live_comment',
}

export enum MappingStrategy {
  SKU = 'sku',
  SEQUENTIAL_ID = 'sequential_id',
  KEYWORD = 'keyword',
  BARCODE = 'barcode',
}

export interface Shop {
  id: string;
  shopifyDomain: string;
  accessToken: string;
  scopes: string;
  igAccountId?: string;
  igAccessToken?: string;
  installedAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  id: string;
  shopId: string;
  name: string;
  holdTimeMinutes: number;
  perPersonLimit?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MappingRule {
  id: string;
  campaignId: string;
  strategy: MappingStrategy;
  triggerPattern: string;
  shopifyVariantId?: string;
  shopifyProductId?: string;
  sku?: string;
  sequentialId?: number;
  createdAt: Date;
}

export interface Claim {
  id: string;
  shopId: string;
  campaignId?: string;
  status: ClaimStatus;
  channel: TriggerChannel;
  igUserId: string;
  igUsername?: string;
  igMessageId: string;
  rawMessage: string;
  parsedIntent?: string;
  matchedVariantId?: string;
  shopifyDraftOrderId?: string;
  checkoutUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reservation {
  id: string;
  claimId: string;
  variantId: string;
  quantity: number;
  expiresAt: Date;
  released: boolean;
  createdAt: Date;
}

export interface ParsedClaimIntent {
  strategy: MappingStrategy;
  identifier: string | number;
  quantity?: number;
  size?: string;
  color?: string;
}

export interface MetaWebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text: string;
      };
    }>;
    changes?: Array<{
      field: string;
      value: any;
    }>;
  }>;
}

export interface ShopifyDraftOrderInput {
  lineItems: Array<{
    variantId: string;
    quantity: number;
  }>;
  customerId?: string;
  email?: string;
  note?: string;
  tags?: string[];
}
