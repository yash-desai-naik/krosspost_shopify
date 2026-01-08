# Instagram DM Implementation Guide - From Scratch

This guide provides everything you need to implement Instagram Direct Messaging functionality in a new project.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Dependencies](#dependencies)
4. [Database Schema](#database-schema)
5. [Core Implementation](#core-implementation)
6. [API Endpoints](#api-endpoints)
7. [Webhook Setup](#webhook-setup)
8. [Complete Code Examples](#complete-code-examples)
9. [Testing](#testing)

---

## 🔧 Prerequisites

### Meta/Facebook App Setup

1. **Create a Meta App**
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create a new app → Select "Business" type
   - Add "Instagram" product to your app

2. **Configure Instagram Basic Display**
   - Add Instagram Basic Display product
   - Configure OAuth Redirect URIs
   - Get your App ID and App Secret

3. **Get Instagram Business Account**
   - Convert your Instagram account to Business/Creator account
   - Link it to a Facebook Page
   - Connect the Facebook Page to your Meta App

4. **Required Permissions**
   - `instagram_basic`
   - `instagram_manage_messages`
   - `instagram_manage_comments`
   - `pages_manage_metadata`
   - `pages_read_engagement`

5. **Webhook Configuration**
   - Set up webhook URL: `https://your-domain.com/webhook/instagram`
   - Subscribe to fields: `messages`, `messaging_postbacks`
   - Set a verify token (custom string you choose)

---

## 🔐 Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=instagram_dm_app

# Instagram/Meta OAuth
INSTAGRAM_CLIENT_ID=your_instagram_app_id
INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret
META_KROSSPOST_APP_ID=your_meta_app_id
META_KROSSPOST_APP_SECRET=your_meta_app_secret

# Webhook
META_WEBHOOK_VERIFY_TOKEN=your_custom_verify_token_here

# Application
ENVIRONMENT=production
FRONTEND_URL=https://your-frontend.com
API_URL=https://your-api.com
JWT_SECRET=your_jwt_secret_key

# Encryption (for storing access tokens)
ENCRYPTION_KEY=your_32_byte_encryption_key

# Optional: AWS S3 for media
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_bucket
```

---

## 📦 Dependencies

### Python Requirements (`requirements.txt`)

```txt
# Web Framework
fastapi>=0.110.2
uvicorn>=0.29.0
python-multipart>=0.0.9

# Database
motor>=3.3.2
pymongo>=4.6.2

# HTTP Client
aiohttp>=3.9.5
requests>=2.31.0

# Authentication & Security
pyjwt>=2.8.0
python-jose>=3.3.0
cryptography>=42.0.7
passlib>=1.7.4

# Environment & Config
python-dotenv>=1.0.1
pydantic>=2.6.4
pydantic-settings>=2.2.1

# Utilities
python-dateutil>=2.9.0
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 🗄️ Database Schema

### MongoDB Collections

#### 1. `accounts` Collection

```javascript
{
  "_id": ObjectId("..."),
  "user_id": "user_123",
  "platform": "meta_instagram",
  "access_token": "encrypted_token_here",
  "refresh_token": "encrypted_refresh_token",
  "expires_in": 5184000,
  "created_at": ISODate("2024-01-01T00:00:00Z"),
  "updated_at": ISODate("2024-01-01T00:00:00Z"),
  "instagram_data": {
    "ig_id": "17841400000000000",
    "id": "17841400000000000",
    "username": "your_business_account"
  },
  "meta": {
    "id": "17841400000000000",
    "name": "Your Business Name",
    "username": "your_business_account"
  }
}
```

#### 2. `instagram_dms` Collection

```javascript
{
  "_id": ObjectId("..."),
  "platform_account_id": "account_object_id",
  "ig_id": "17841400000000000",
  "user_id": "user_123",
  "sender_id": "sender_ig_id",
  "sender_name": "John Doe",
  "recipient_id": "recipient_ig_id",
  "recipient_name": "Your Business",
  "message_id": "mid.xxx",
  "text": "Hello, I have a question",
  "timestamp": 1704067200000,
  "is_echo": false,
  "direction": "inbound", // or "outbound"
  "read": false,
  "manual_dm": false,
  "raw": {
    // Original webhook payload
  },
  "created_at": ISODate("2024-01-01T00:00:00Z"),
  "updated_at": ISODate("2024-01-01T00:00:00Z"),
  "is_deleted": false
}
```

#### 3. `user_settings` Collection

```javascript
{
  "_id": ObjectId("..."),
  "user_id": "user_123",
  "platform": "instagram",
  "is_active": true,
  "is_deleted": false,
  "configs": [
    {
      "config_name": "My Instagram Account",
      "account_id": "account_object_id",
      "is_active": true,
      "is_deleted": false
    }
  ],
  "created_at": ISODate("2024-01-01T00:00:00Z"),
  "updated_at": ISODate("2024-01-01T00:00:00Z")
}
```

---

## 💻 Core Implementation

### 1. Encryption Utility (`utils/encryption.py`)

```python
import os
from cryptography.fernet import Fernet
from base64 import b64encode, b64decode

class Encryptor:
    """Utility class for encrypting and decrypting sensitive data"""
    
    @staticmethod
    def _get_key():
        """Get encryption key from environment"""
        key = os.getenv("ENCRYPTION_KEY")
        if not key:
            raise ValueError("ENCRYPTION_KEY not set in environment")
        # Ensure key is 32 bytes for Fernet
        return b64encode(key.encode()[:32].ljust(32, b'0'))
    
    @staticmethod
    def encrypt(data: str) -> str:
        """Encrypt a string"""
        if not data:
            return data
        fernet = Fernet(Encryptor._get_key())
        encrypted = fernet.encrypt(data.encode())
        return encrypted.decode()
    
    @staticmethod
    def decrypt(encrypted_data: str) -> str:
        """Decrypt a string"""
        if not encrypted_data:
            return encrypted_data
        try:
            fernet = Fernet(Encryptor._get_key())
            decrypted = fernet.decrypt(encrypted_data.encode())
            return decrypted.decode()
        except Exception:
            # If decryption fails, assume it's already decrypted
            return encrypted_data
```

### 2. Database Connection (`database.py`)

```python
import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

class Database:
    client: Optional[AsyncIOMotorClient] = None
    
    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        if cls.client is None:
            db_url = os.getenv("DATABASE_URL")
            cls.client = AsyncIOMotorClient(db_url)
        return cls.client
    
    @classmethod
    def get_database(cls) -> AsyncIOMotorDatabase:
        client = cls.get_client()
        db_name = os.getenv("DATABASE_NAME")
        return client[db_name]
    
    @classmethod
    async def close(cls):
        if cls.client:
            cls.client.close()
            cls.client = None

async def get_database() -> AsyncIOMotorDatabase:
    """Dependency for FastAPI endpoints"""
    return Database.get_database()
```

### 3. Instagram API Client (`services/instagram_api.py`)

```python
import aiohttp
import os
from typing import Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from utils.encryption import Encryptor

class InstagramAPI:
    """Instagram Graph API client for DM operations"""
    
    def __init__(self, account_id: str, db: AsyncIOMotorDatabase):
        self.base_url = "https://graph.instagram.com"
        self.api_version = "v24.0"
        self.account_id = account_id
        self.db = db
        self.access_token = None
        self.ig_user_id = None
        self.username = None
    
    async def initialize(self):
        """Load account details from database"""
        account = await self.db.accounts.find_one(
            {"_id": ObjectId(self.account_id)}
        )
        
        if not account:
            raise ValueError(f"Account {self.account_id} not found")
        
        self.access_token = Encryptor.decrypt(account.get("access_token"))
        self.ig_user_id = account.get("instagram_data", {}).get("ig_id")
        self.username = account.get("meta", {}).get("username")
        
        if not self.access_token or not self.ig_user_id:
            raise ValueError("Incomplete Instagram account configuration")
    
    async def get_user_info(self, user_id: str) -> Dict:
        """
        Fetch Instagram user info by ID
        
        Args:
            user_id: Instagram user ID
            
        Returns:
            Dict with id, name, username
        """
        params = {
            "fields": "id,name,username",
            "access_token": self.access_token
        }
        
        url = f"{self.base_url}/{self.api_version}/{user_id}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Failed to get user info: {error_text}")
                
                result = await response.json()
                return {
                    "id": result.get("id"),
                    "name": result.get("name", "User"),
                    "username": result.get("username", "user")
                }
    
    async def send_message(
        self, 
        recipient_id: str, 
        message_text: str
    ) -> Dict:
        """
        Send a direct message to an Instagram user
        
        Args:
            recipient_id: Instagram user ID of recipient
            message_text: Message content
            
        Returns:
            API response with message_id
        """
        url = f"{self.base_url}/{self.api_version}/{self.ig_user_id}/messages"
        
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": message_text}
        }
        
        params = {"access_token": self.access_token}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, 
                json=payload, 
                params=params
            ) as response:
                result = await response.json()
                
                if response.status != 200:
                    error_msg = result.get("error", {}).get("message", "Unknown error")
                    raise Exception(f"Failed to send message: {error_msg}")
                
                return result
    
    async def send_message_to_comment(
        self, 
        comment_id: str, 
        message_text: str
    ) -> Dict:
        """
        Send a DM in response to a comment
        
        Args:
            comment_id: Instagram comment ID
            message_text: Message content
            
        Returns:
            API response
        """
        url = f"{self.base_url}/{self.api_version}/{self.ig_user_id}/messages"
        
        payload = {
            "recipient": {"comment_id": comment_id},
            "message": {"text": message_text}
        }
        
        params = {"access_token": self.access_token}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, 
                json=payload, 
                params=params
            ) as response:
                result = await response.json()
                
                if response.status != 200:
                    error_msg = result.get("error", {}).get("message", "Unknown error")
                    raise Exception(f"Failed to send DM to comment: {error_msg}")
                
                return result
```

---

## 🌐 API Endpoints

### Complete FastAPI Implementation (`main.py`)

```python
from fastapi import FastAPI, Request, HTTPException, Depends, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import os
import logging

from database import get_database
from services.instagram_api import InstagramAPI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Instagram DM API")

# Pydantic Models
class SendDMRequest(BaseModel):
    recipient_id: str
    message_text: str
    platform_account_id: str

class UpdateDMRequest(BaseModel):
    text: Optional[str] = None
    read: Optional[bool] = None

# Helper function to convert ObjectId to string
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

# ============================================
# WEBHOOK ENDPOINTS
# ============================================

@app.get("/webhook/instagram")
async def verify_instagram_webhook(request: Request):
    """
    Instagram Webhook Verification Endpoint
    Called by Meta to verify the webhook URL
    """
    VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "").strip()
    
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token", "").strip()
    challenge = params.get("hub.challenge")
    
    logger.info(f"Webhook verification: mode={mode}, token_match={token == VERIFY_TOKEN}")
    
    if mode == "subscribe" and token == VERIFY_TOKEN:
        return PlainTextResponse(content=challenge)
    
    raise HTTPException(status_code=403, detail="Verification failed")


@app.post("/webhook/instagram")
async def instagram_webhook(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Receive webhook updates from Instagram for DMs
    """
    try:
        payload = await request.json()
        logger.info(f"Instagram Webhook Payload: {payload}")
        
        # Extract Instagram ID from webhook
        ig_data_ig_id = payload["entry"][0]["id"]
        
        # Get messaging events
        messaging_array = payload.get("entry", [{}])[0].get("messaging", [])
        
        if not messaging_array:
            return JSONResponse(
                status_code=200, 
                content={"success": True, "message": "No messaging events"}
            )
        
        # Find account in database
        recipient_id = messaging_array[0].get("recipient", {}).get("id")
        
        query_list = [
            {"instagram_data.ig_id": ig_data_ig_id},
            {"instagram_data.id": ig_data_ig_id},
        ]
        
        if recipient_id and recipient_id != ig_data_ig_id:
            query_list.extend([
                {"instagram_data.ig_id": recipient_id},
                {"instagram_data.id": recipient_id},
            ])
        
        account = await db.accounts.find_one({"$or": query_list})
        
        if not account:
            logger.warning(f"Account not found for IG ID: {ig_data_ig_id}")
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Account not found"}
            )
        
        platform_account_id = str(account["_id"])
        user_id = str(account["user_id"])
        
        # Initialize Instagram API
        ig_api = InstagramAPI(platform_account_id, db)
        await ig_api.initialize()
        
        # Process each message event
        for msg_event in messaging_array:
            sender_id = msg_event.get("sender", {}).get("id")
            recipient_id = msg_event.get("recipient", {}).get("id")
            
            # Handle incoming/outgoing messages
            if "message" in msg_event:
                message = msg_event["message"]
                is_echo = message.get("is_echo", False)
                
                # Get sender and recipient info
                sender_info = await ig_api.get_user_info(sender_id)
                recipient_info = await ig_api.get_user_info(recipient_id)
                
                # Parse timestamp
                raw_timestamp = msg_event.get("timestamp")
                try:
                    timestamp = float(raw_timestamp) if raw_timestamp else datetime.utcnow().timestamp()
                    if timestamp > 1e12:  # Convert milliseconds to seconds
                        timestamp /= 1000
                except (TypeError, ValueError):
                    timestamp = datetime.utcnow().timestamp()
                
                # Create DM document
                dm_doc = {
                    "platform_account_id": platform_account_id,
                    "ig_id": ig_data_ig_id,
                    "user_id": user_id,
                    "sender_id": sender_id,
                    "sender_name": sender_info.get("name", "User"),
                    "recipient_id": recipient_id,
                    "recipient_name": recipient_info.get("name", "User"),
                    "timestamp": msg_event.get("timestamp"),
                    "message_id": message.get("mid"),
                    "text": message.get("text"),
                    "is_echo": is_echo,
                    "raw": message,
                    "created_at": datetime.fromtimestamp(timestamp),
                    "direction": "outbound" if is_echo else "inbound",
                    "read": True if is_echo else False,
                    "manual_dm": False,
                    "is_deleted": False
                }
                
                # Store in database
                await db.instagram_dms.insert_one(dm_doc)
                logger.info(f"Stored Instagram DM: {dm_doc['message_id']}")
            
            # Handle read receipts
            elif "read" in msg_event:
                read = msg_event["read"]
                read_mid = read.get("mid")
                
                # Update message as read
                await db.instagram_dms.update_one(
                    {"message_id": read_mid, "direction": "inbound"},
                    {"$set": {"read": True}}
                )
                logger.info(f"Marked message {read_mid} as read")
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "processed": len(messaging_array)}
        )
        
    except Exception as e:
        logger.exception("Error processing Instagram webhook")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# DM MANAGEMENT ENDPOINTS
# ============================================

@app.get("/instagram-dms/list")
async def list_dms(
    platform_account_id: Optional[str] = None,
    user_id: Optional[str] = None,
    sender_id: Optional[str] = None,
    recipient_id: Optional[str] = None,
    direction: Optional[str] = None,
    read: Optional[bool] = None,
    limit: int = Query(50, le=100),
    skip: int = 0,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List Instagram DMs with filters
    """
    try:
        # Build query
        query = {"is_deleted": False}
        
        if platform_account_id:
            query["platform_account_id"] = platform_account_id
        if user_id:
            query["user_id"] = user_id
        if sender_id:
            query["sender_id"] = sender_id
        if recipient_id:
            query["recipient_id"] = recipient_id
        if direction:
            query["direction"] = direction
        if read is not None:
            query["read"] = read
        
        # Fetch DMs
        cursor = db.instagram_dms.find(query).sort("created_at", -1).skip(skip).limit(limit)
        dms = await cursor.to_list(length=limit)
        
        # Get total count
        total = await db.instagram_dms.count_documents(query)
        
        # Serialize ObjectIds
        dms = [serialize_doc(dm) for dm in dms]
        
        return {
            "success": True,
            "data": dms,
            "total": total,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        logger.exception("Error listing DMs")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/instagram-dms/send")
async def send_dm(
    body: SendDMRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Send an Instagram DM
    """
    try:
        # Initialize Instagram API
        ig_api = InstagramAPI(body.platform_account_id, db)
        await ig_api.initialize()
        
        # Send message
        result = await ig_api.send_message(
            recipient_id=body.recipient_id,
            message_text=body.message_text
        )
        
        # Store outbound message
        dm_doc = {
            "platform_account_id": body.platform_account_id,
            "ig_id": ig_api.ig_user_id,
            "user_id": None,  # Set from auth if available
            "sender_id": ig_api.ig_user_id,
            "sender_name": ig_api.username,
            "recipient_id": body.recipient_id,
            "recipient_name": "User",
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
            "message_id": result.get("message_id") or result.get("id"),
            "text": body.message_text,
            "is_echo": False,
            "raw": result,
            "created_at": datetime.now(timezone.utc),
            "direction": "outbound",
            "read": True,
            "manual_dm": True,
            "is_deleted": False
        }
        
        await db.instagram_dms.insert_one(dm_doc)
        
        return {
            "success": True,
            "result": result,
            "stored": serialize_doc(dm_doc)
        }
        
    except Exception as e:
        logger.exception("Error sending DM")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/instagram-dms/{dm_id}")
async def update_dm(
    dm_id: str,
    body: UpdateDMRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update a DM (mark as read, update text, etc.)
    """
    try:
        if not ObjectId.is_valid(dm_id):
            raise HTTPException(status_code=400, detail="Invalid DM ID")
        
        # Build update data
        update_data = {k: v for k, v in body.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No update fields provided")
        
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # Update DM
        result = await db.instagram_dms.update_one(
            {"_id": ObjectId(dm_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="DM not found")
        
        # Fetch updated DM
        dm = await db.instagram_dms.find_one({"_id": ObjectId(dm_id)})
        
        return {
            "success": True,
            "data": serialize_doc(dm)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error updating DM")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/instagram-dms/{dm_id}")
async def delete_dm(
    dm_id: str,
    hard: bool = Query(False),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Delete a DM (soft delete by default, hard delete if hard=true)
    """
    try:
        if not ObjectId.is_valid(dm_id):
            raise HTTPException(status_code=400, detail="Invalid DM ID")
        
        if hard:
            # Hard delete
            result = await db.instagram_dms.delete_one({"_id": ObjectId(dm_id)})
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="DM not found")
            return {"success": True, "deleted": True}
        else:
            # Soft delete
            result = await db.instagram_dms.update_one(
                {"_id": ObjectId(dm_id)},
                {
                    "$set": {
                        "is_deleted": True,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="DM not found")
            return {"success": True, "deleted": False, "soft_deleted": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting DM")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# HEALTH CHECK
# ============================================

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Instagram DM API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 🧪 Testing

### 1. Test Webhook Verification

```bash
curl -X GET "http://localhost:8000/webhook/instagram?hub.mode=subscribe&hub.verify_token=your_custom_verify_token_here&hub.challenge=test_challenge"
```

**Expected Response:** `test_challenge`

### 2. Test Sending a DM

```bash
curl -X POST "http://localhost:8000/instagram-dms/send" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_id": "instagram_user_id",
    "message_text": "Hello from API!",
    "platform_account_id": "your_account_object_id"
  }'
```

### 3. Test Listing DMs

```bash
curl -X GET "http://localhost:8000/instagram-dms/list?platform_account_id=your_account_id&limit=10"
```

### 4. Test Webhook Payload (Simulate Instagram)

```bash
curl -X POST "http://localhost:8000/webhook/instagram" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "your_ig_id",
      "time": 1704067200,
      "messaging": [{
        "sender": {"id": "sender_ig_id"},
        "recipient": {"id": "your_ig_id"},
        "timestamp": 1704067200000,
        "message": {
          "mid": "mid.xxx",
          "text": "Test message"
        }
      }]
    }]
  }'
```

---

## 🚀 Deployment Checklist

### 1. Meta Developer Console Setup

- ✅ Create Meta App
- ✅ Add Instagram product
- ✅ Configure OAuth redirect URIs
- ✅ Set webhook URL: `https://your-domain.com/webhook/instagram`
- ✅ Set webhook verify token
- ✅ Subscribe to `messages` field
- ✅ Get App ID and App Secret

### 2. Instagram Account Setup

- ✅ Convert to Business/Creator account
- ✅ Link to Facebook Page
- ✅ Connect Page to Meta App
- ✅ Get Instagram Business Account ID

### 3. Application Setup

- ✅ Set all environment variables
- ✅ Create MongoDB database and collections
- ✅ Deploy application to server with HTTPS
- ✅ Test webhook verification
- ✅ Test sending/receiving DMs

### 4. Security Considerations

- ✅ Use HTTPS for webhook endpoint
- ✅ Encrypt access tokens in database
- ✅ Validate webhook signatures (optional but recommended)
- ✅ Implement rate limiting
- ✅ Add authentication to API endpoints
- ✅ Sanitize user inputs

---

## 📚 Additional Resources

### Instagram Graph API Documentation
- [Instagram Messaging API](https://developers.facebook.com/docs/messenger-platform/instagram)
- [Webhooks for Instagram](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- [Instagram Graph API Reference](https://developers.facebook.com/docs/instagram-api)

### Example Webhook Payload (Message)

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000000",
      "time": 1704067200,
      "messaging": [
        {
          "sender": {
            "id": "sender_ig_id"
          },
          "recipient": {
            "id": "your_ig_id"
          },
          "timestamp": 1704067200000,
          "message": {
            "mid": "mid.xxx",
            "text": "Hello, I have a question about your product"
          }
        }
      ]
    }
  ]
}
```

### Example Webhook Payload (Read Receipt)

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000000",
      "time": 1704067200,
      "messaging": [
        {
          "sender": {
            "id": "sender_ig_id"
          },
          "recipient": {
            "id": "your_ig_id"
          },
          "timestamp": 1704067200000,
          "read": {
            "mid": "mid.xxx"
          }
        }
      ]
    }
  ]
}
```

---

## 🔍 Troubleshooting

### Common Issues

**1. Webhook not receiving events**
- Verify webhook URL is HTTPS
- Check verify token matches
- Ensure `messages` field is subscribed
- Check Meta App is in Live mode (not Development)

**2. "Invalid OAuth access token"**
- Token may have expired - refresh it
- Check token has correct permissions
- Ensure token is properly decrypted

**3. "Unsupported request"**
- Verify Instagram account is Business/Creator
- Check account is linked to Facebook Page
- Ensure Page is connected to Meta App

**4. Messages not storing in database**
- Check MongoDB connection
- Verify account exists in database
- Check logs for errors

---

## 📝 Notes

- Instagram DMs only work with **Business** or **Creator** accounts
- You need a **Facebook Page** linked to your Instagram account
- Webhooks require **HTTPS** endpoint
- Access tokens expire - implement refresh logic
- Rate limits apply - implement exponential backoff
- Store tokens encrypted in database
- Test thoroughly in sandbox before production

---

**Happy Coding! 🚀**
