const crypto = require('crypto');

// Test HMAC verification logic
const apiSecret = process.env.SHOPIFY_API_SECRET || 'test-secret';

function verifyShopifyHMAC(body, hmacHeader) {
  try {
    const hmac = crypto
      .createHmac('sha256', apiSecret)
      .update(body, 'utf8')
      .digest('base64');
    
    console.log('Generated HMAC:', hmac);
    console.log('Received HMAC:', hmacHeader);
    console.log('Match:', hmac === hmacHeader);
    
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hmacHeader));
  } catch (error) {
    console.error('HMAC verification error:', error.message);
    return false;
  }
}

// Test with sample data
const testBody = JSON.stringify({
  shop_domain: 'test-shop.myshopify.com',
  customer: {
    id: 123,
    email: 'test@example.com'
  }
});

const testHmac = crypto
  .createHmac('sha256', apiSecret)
  .update(testBody, 'utf8')
  .digest('base64');

console.log('\n=== HMAC Verification Test ===');
console.log('Body:', testBody);
console.log('Secret:', apiSecret);
console.log('Expected HMAC:', testHmac);
console.log('\nVerification result:', verifyShopifyHMAC(testBody, testHmac));
