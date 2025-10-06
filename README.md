# Rollbar to Google Chat Webhook Integration

This project forwards Rollbar error notifications to Google Chat with **intelligent threading** to prevent spam.

## 🎯 Features

- **Smart Threading**: Groups error notifications by Rollbar Item Counter
  - Each unique error gets its own thread
  - Multiple occurrences of the same error are grouped together
  - Prevents spam by organizing errors into threads

- **Rich Error Information**:
  - Error level (Critical, Error, Warning, etc.)
  - Project name and environment
  - Error title and description
  - Occurrence count
  - Direct link to Rollbar dashboard

## 🚀 Deployment on Vercel

1. **Clone and Deploy**:
   ```bash
   vercel --prod
   ```

2. **Set Environment Variable**:
   In Vercel dashboard, add:
   ```
   GCHAT_WEBHOOK_URL=<your-google-chat-webhook-url>
   ```

3. **Configure Rollbar**:
   - Go to Rollbar Project Settings → Notifications → Webhook
   - Add webhook URL: `https://your-vercel-app.vercel.app/api/webhook`
   - Select events: `new_item`, `reactivated_item`, `occurrence`

## 🧵 How Threading Works

The integration uses **Rollbar Item Counter** as the thread key:

```javascript
const threadKey = `rollbar-item-${counter}`;
```

**Example**:
- Error "Cannot read property 'map' of undefined" (Counter: 12345)
  - First occurrence → Creates new thread
  - Second occurrence → Posts in same thread
  - Third occurrence → Posts in same thread

- Different error "Database connection failed" (Counter: 67890)
  - First occurrence → Creates **new separate thread**

This ensures your Google Chat space stays organized with one thread per unique error type.

## 📊 Comprehensive Logging

All logs are single-line for easy parsing and searching:

### Log Examples:
```
[2025-10-06T12:28:03.000Z] 📥 INCOMING_REQUEST event_name=new_item
[2025-10-06T12:28:03.000Z] 📊 PARSED_DATA project="order_fulfillment" environment="production" level=40(ERROR) counter=3069 threadKey="rollbar-item-3069" title="Error while processing the message - {\"pick_slip_number\":null,\"pick_slip_line\":null,\"line_..."
[2025-10-06T12:28:03.000Z] 📤 SENDING_TO_GCHAT threadKey="rollbar-item-3069" occurrences=2
[2025-10-06T12:28:03.000Z] ✅ GCHAT_SUCCESS status=200 threadName="spaces/AAAAabEKpDU/threads/abc123xyz"
```

### Error Log Example:
```
[2025-10-06T12:28:03.000Z] ❌ GCHAT_ERROR message="Request failed with status code 400" statusCode=400 errorData={"error":{"message":"Invalid request"}}
```

### Other Logs:
```
[2025-10-06T12:28:03.000Z] ✅ TEST_WEBHOOK_RECEIVED
[2025-10-06T12:28:03.000Z] ❌ INVALID_PAYLOAD error="missing data.item"
[2025-10-06T12:28:03.000Z] ❌ GCHAT_WEBHOOK_URL_NOT_CONFIGURED
```

You can view these logs in Vercel's deployment logs or by running `vercel logs`. Use grep/search to filter:
```bash
vercel logs | grep GCHAT_ERROR
vercel logs | grep counter=3069
```

## 📋 Message Format

Messages are color-coded by severity:
- 🔴 CRITICAL (level 50)
- 🟠 ERROR (level 40)
- 🟡 WARNING (level 30)
- 🔵 INFO (level 20)
- ⚪ DEBUG (level 10)

Example message:
```
🟠 ERROR in Rollbar 🟠
━━━━━━━━━━━━━━━━━━━━━━
Project: order_fulfillment
Environment: production
Error: Error while processing the message - {"pick_slip_number":null,"pick_slip_line":null...
Location: Error: No Qty level information found
Occurrences: 2
First Seen: 10/6/2025, 5:56:49 PM
Last Seen: 10/6/2025, 5:56:49 PM
━━━━━━━━━━━━━━━━━━━━━━
🔗 View Full Error Details
```

## 🔧 Optional: Filter by Error Level

To only receive critical errors (level 50), uncomment and modify lines 66-69 in `index.js`:

```javascript
if (level !== 50) {  // Only show CRITICAL errors
    return res.status(200).json({ message: "Ignoring non-critical errors" });
}
```

## 📝 Testing

Test the webhook:
```bash
curl -X POST https://your-vercel-app.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"event_name":"test"}'
```

## 🛠️ Tech Stack

- **Node.js** + Express
- **Axios** for HTTP requests
- **Vercel** for serverless deployment
- **Google Chat Webhook API**

## 📚 Google Chat Threading

The integration uses the `threadKey` query parameter to enable threading:
```javascript
const webhookUrlWithThread = `${GOOGLE_CHAT_WEBHOOK}&threadKey=${threadKey}`;
```

This is the recommended approach for Google Chat incoming webhooks to maintain conversation threads.

