import axios from 'axios';
import { config } from '../config';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

export async function sendInstagramDM(
  accessToken: string,
  recipientId: string,
  message: string
): Promise<void> {
  try {
    console.log('📤 Sending Instagram DM to:', recipientId);
    
    const response = await axios.post(
      `${GRAPH_API_BASE}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message },
      },
      {
        params: { access_token: accessToken },
      }
    );
    
    console.log('✅ Instagram DM sent successfully:', response.data);
  } catch (error: any) {
    console.error('❌ Failed to send Instagram DM:', error.response?.data || error.message);
    throw error;
  }
}

export async function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): Promise<string | null> {
  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
    return challenge;
  }
  return null;
}

export interface InstagramWebhookMessage {
  senderId: string;
  recipientId: string;
  messageId: string;
  text: string;
  timestamp: number;
}

export function parseInstagramWebhook(body: any): InstagramWebhookMessage[] {
  const messages: InstagramWebhookMessage[] = [];
  
  if (body.object !== 'instagram' && body.object !== 'page') {
    return messages;
  }
  
  for (const entry of body.entry || []) {
    if (entry.messaging) {
      for (const event of entry.messaging) {
        if (event.message?.text) {
          messages.push({
            senderId: event.sender.id,
            recipientId: event.recipient.id,
            messageId: event.message.mid,
            text: event.message.text,
            timestamp: event.timestamp,
          });
        }
      }
    }
    
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'comments' && change.value?.text) {
          messages.push({
            senderId: change.value.from?.id || 'unknown',
            recipientId: entry.id,
            messageId: change.value.id,
            text: change.value.text,
            timestamp: Date.now(),
          });
        }
      }
    }
  }
  
  return messages;
}
