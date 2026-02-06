import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import axios from 'axios';
import { config } from '../config';
import { updateShopIGConnection } from '../services/shopify';
import { queryOne } from '../db';
import { Shop } from '../types';

const router: ExpressRouter = Router();

const INSTAGRAM_OAUTH_URL = 'https://www.instagram.com/oauth/authorize';
const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_API_BASE = 'https://graph.instagram.com';

router.get('/auth/instagram/url', async (req: Request, res: Response) => {
  const shopDomain = req.query.shop as string;
  
  if (!shopDomain) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  const redirectUri = `${config.app.url}/auth/instagram/callback`;
  const state = Buffer.from(JSON.stringify({ shop: shopDomain })).toString('base64');
  
  const authUrl = new URL(INSTAGRAM_OAUTH_URL);
  authUrl.searchParams.set('client_id', config.meta.appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  
  res.json({ authUrl: authUrl.toString() });
});

router.get('/auth/instagram', async (req: Request, res: Response) => {
  const shopDomain = req.query.shop as string;
  
  if (!shopDomain) {
    return res.status(400).send('Missing shop parameter');
  }
  
  const redirectUri = `${config.app.url}/auth/instagram/callback`;
  const state = Buffer.from(JSON.stringify({ shop: shopDomain })).toString('base64');
  
  const authUrl = new URL(INSTAGRAM_OAUTH_URL);
  authUrl.searchParams.set('client_id', config.meta.appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  
  console.log('Instagram OAuth URL:', authUrl.toString());
  
  // Return HTML that opens Instagram OAuth in a new window to break out of Shopify iframe
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Instagram Connect</title>
      </head>
      <body>
        <script>
          window.opener.location.href = '${authUrl.toString()}';
          window.close();
        </script>
        <p>Redirecting to Instagram... If you are not redirected, <a href="${authUrl.toString()}" target="_blank">click here</a></p>
      </body>
    </html>
  `);
});

router.get('/auth/instagram/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;
    
    if (error) {
      console.error('Instagram OAuth error:', error, req.query.error_reason, req.query.error_description);
      return res.status(400).send(`Instagram authorization failed: ${req.query.error_description || error}`);
    }
    
    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }
    
    const { shop } = JSON.parse(Buffer.from(state, 'base64').toString());
    
    const shopRecord = await queryOne<Shop>(
      'SELECT * FROM shops WHERE shopify_domain = $1',
      [shop]
    );
    
    if (!shopRecord) {
      return res.status(404).send('Shop not found');
    }
    
    const redirectUri = `${config.app.url}/auth/instagram/callback`;
    
    console.log('Exchanging code for access token...');
    console.log('Token exchange params:', {
      url: INSTAGRAM_TOKEN_URL,
      client_id: config.meta.appId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    
    const tokenResponse = await axios.post(
      INSTAGRAM_TOKEN_URL,
      new URLSearchParams({
        client_id: config.meta.appId,
        client_secret: config.meta.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    console.log('Token response:', tokenResponse.data);
    const { access_token } = tokenResponse.data;
    
    const userInfoResponse = await axios.get(
      `${GRAPH_API_BASE}/me`,
      {
        params: {
          fields: 'user_id,username',
          access_token,
        },
      }
    );
    
    console.log('Instagram user info:', userInfoResponse.data);
    const igBusinessAccountId = userInfoResponse.data.user_id;
    console.log('Saving Instagram Business Account ID:', igBusinessAccountId);
    
    await updateShopIGConnection(shopRecord.id, igBusinessAccountId, access_token);
    
    const successUrl = `${config.app.url}/?shop=${shop}&instagram_connected=true`;
    
    // Return HTML that closes the window and notifies parent iframe
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Instagram Connected</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              // Notify opener window about successful connection
              window.opener.location.href = '${successUrl}';
              window.close();
            } else {
              // Fallback if not opened as popup
              window.location.href = '${successUrl}';
            }
          </script>
          <p>Instagram connected successfully! Redirecting...</p>
        </body>
      </html>
    `);
    
  } catch (error: any) {
    console.error('Instagram OAuth error:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message || error.response?.data?.error_message || error.message;
    res.status(500).send(`Instagram authentication failed: ${errorMsg}`);
  }
});

export default router;
