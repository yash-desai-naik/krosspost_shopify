import { Router, Request, Response, IRouter } from 'express';
import { getShopify, saveShop, getShop, deleteShop } from '../services/shopify';
import { config } from '../config';

const router: IRouter = Router();

router.get('/auth/shopify', async (req: Request, res: Response) => {
  const shop = req.query.shop as string;
  
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }
  
  const shopify = getShopify();
  await shopify.auth.begin({
    shop: shopify.utils.sanitizeShop(shop, true)!,
    callbackPath: '/auth/shopify/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

router.get('/auth/shopify/callback', async (req: Request, res: Response) => {
  try {
    const shopify = getShopify();
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });
    
    const { session } = callback;
    
    await saveShop({
      shopifyDomain: session.shop,
      accessToken: session.accessToken!,
      scopes: config.shopify.scopes,
    });
    
    const host = req.query.host as string;
    const redirectUrl = `https://${session.shop}/admin/apps/${config.shopify.apiKey}`;
    
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

router.post('/webhooks/shopify/app_uninstalled', async (req: Request, res: Response) => {
  try {
    const shop = req.body.myshopify_domain;
    
    if (shop) {
      await deleteShop(shop);
      console.log(`Shop ${shop} uninstalled and cleaned up`);
    }
    
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Uninstall webhook error:', error);
    res.status(500).send('Error processing uninstall');
  }
});

export default router;
