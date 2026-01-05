import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { verifyWebhook, parseInstagramWebhook } from '../services/instagram';
import { createClaim, processClaim } from '../services/claims';
import { TriggerChannel } from '../types';
import { queryOne } from '../db';
import { Shop } from '../types';

const router: ExpressRouter = Router();

router.get('/webhooks/meta', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;
  
  const result = await verifyWebhook(mode, token, challenge);
  
  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).send('Forbidden');
  }
});

router.post('/webhooks/meta', async (req: Request, res: Response) => {
  try {
    console.log('📨 Received Instagram webhook:');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const messages = parseInstagramWebhook(req.body);
    console.log(`Parsed ${messages.length} message(s):`, JSON.stringify(messages, null, 2));
    
    for (const msg of messages) {
      console.log('Processing message:', JSON.stringify(msg, null, 2));
      
      const shop = await queryOne<Shop>(
        'SELECT * FROM shops WHERE ig_account_id = $1',
        [msg.recipientId]
      );
      
      if (!shop) {
        console.log(`No shop found for IG account ${msg.recipientId}`);
        continue;
      }
      
      const activeCampaign = await queryOne<any>(
        'SELECT * FROM campaigns WHERE shop_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [shop.id]
      );
      
      console.log('Active campaign query result:', activeCampaign);
      
      if (!activeCampaign) {
        console.log('⚠️ No active campaign found for shop:', shop.id);
      }
      
      const claim = await createClaim({
        shopId: shop.id,
        campaignId: activeCampaign?.id,
        channel: TriggerChannel.DM,
        igUserId: msg.senderId,
        igMessageId: msg.messageId,
        rawMessage: msg.text,
      });
      
      await processClaim(claim.id);
      console.log(`✅ Claim processed: ${claim.id}`);
    }
    
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('❌ Instagram webhook error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send('Error processing webhook');
  }
});

export default router;
