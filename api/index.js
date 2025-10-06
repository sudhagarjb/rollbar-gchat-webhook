const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json()); // Middleware to parse JSON requests

app.post("/api/webhook", async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📥 INCOMING_REQUEST event_name=${req.body.event_name}`);

    const { event_name, data } = req.body;

    // Handle Rollbar test webhook
    if (event_name === "test") {
        console.log(`[${timestamp}] ✅ TEST_WEBHOOK_RECEIVED`);
        return res.status(200).json({ message: "Test webhook received successfully!" });
    }

    // Validate actual error payload
    if (!data || !data.item) {
        console.error(`[${timestamp}] ❌ INVALID_PAYLOAD error="missing data.item"`);
        return res.status(400).json({ error: "Invalid payload - missing data.item" });
    }

    const { level, title, project_id, counter, environment } = data.item;
    const url = data.item.url || "No URL provided";
    const projectName = data.item.project_name || `Project-${project_id}`;

    // Map Rollbar numeric levels to string labels
    const levelMap = {
        50: 'CRITICAL',
        40: 'ERROR',
        30: 'WARNING',
        20: 'INFO',
        10: 'DEBUG'
    };
    const levelLabel = levelMap[level] || 'UNKNOWN';
    const levelEmoji = {
        50: '🔴',
        40: '🟠',
        30: '🟡',
        20: '🔵',
        10: '⚪'
    };
    const emoji = levelEmoji[level] || '⚫';

    // Truncate long titles
    const truncatedTitle = title.length > 200 ? title.substring(0, 200) + '...' : title;

    // ✅ Use Rollbar Item Counter as Thread Key (groups same error together)
    // This ensures each unique error gets its own thread, not all errors in one thread
    const threadKey = `rollbar-item-${counter || project_id}`;
    
    console.log(`[${timestamp}] 📊 PARSED_DATA project="${projectName}" environment="${environment}" level=${level}(${levelLabel}) counter=${counter || 'N/A'} threadKey="${threadKey}" title="${truncatedTitle.substring(0, 100)}..."`);

    // Ignore non-critical errors (optional - uncomment to enable)
    // if (level !== "critical") {
    //     return res.status(200).json({ message: "Ignoring non-critical errors" });
    // }

    // Google Chat Webhook URL
    const GOOGLE_CHAT_WEBHOOK = process.env.GCHAT_WEBHOOK_URL;

    if (!GOOGLE_CHAT_WEBHOOK) {
        console.error(`[${timestamp}] ❌ GCHAT_WEBHOOK_URL_NOT_CONFIGURED`);
        return res.status(500).json({ error: "Webhook URL not configured" });
    }

    // Get occurrence info and additional details
    const occurrences = data.item.total_occurrences || data.item.occurrences || 1;
    const firstOccurred = data.item.first_occurrence_timestamp 
        ? new Date(data.item.first_occurrence_timestamp * 1000).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
        : 'N/A';
    const lastOccurred = data.item.last_occurrence_timestamp
        ? new Date(data.item.last_occurrence_timestamp * 1000).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
        : 'N/A';
    
    // Extract stack trace first line if available
    const stackTrace = data.item.last_occurrence?.custom?.stack || data.item.last_occurrence?.stack || '';
    const errorLocation = stackTrace ? stackTrace.split('\n')[0].trim() : '';
    
    // ✅ IMPORTANT: For incoming webhooks, threadKey MUST be in URL parameter only
    const message = {
        text: `${emoji} *${levelLabel} in Rollbar* ${emoji}\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*Project:* ${projectName}\n` +
              `*Environment:* ${environment}\n` +
              `*Error:* ${truncatedTitle}\n` +
              (errorLocation ? `*Location:* \`${errorLocation}\`\n` : '') +
              `*Occurrences:* ${occurrences}\n` +
              `*First Seen:* ${firstOccurred}\n` +
              `*Last Seen:* ${lastOccurred}\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🔗 [View Full Error Details](${url})`
    };

    // Add threadKey as URL parameter for maximum compatibility
    const webhookUrlWithThread = `${GOOGLE_CHAT_WEBHOOK}&threadKey=${threadKey}`;
    
    console.log(`[${timestamp}] 📤 SENDING_TO_GCHAT threadKey="${threadKey}" occurrences=${occurrences}`);

    try {
        const response = await axios.post(webhookUrlWithThread, message);
        
        console.log(`[${timestamp}] ✅ GCHAT_SUCCESS status=${response.status} threadName="${response.data?.thread?.name || 'N/A'}"`);
        
        return res.status(200).json({ 
            message: "Notification sent to Google Chat thread",
            threadKey: threadKey,
            gchatThreadName: response.data?.thread?.name
        });
    } catch (error) {
        console.error(`[${timestamp}] ❌ GCHAT_ERROR message="${error.message}" statusCode=${error.response?.status || 'N/A'} errorData=${JSON.stringify(error.response?.data || {})}`);
        
        return res.status(500).json({ 
            error: "Failed to send notification",
            details: error.message,
            gchatError: error.response?.data
        });
    }
});

// Default Route for testing
app.get("/", (req, res) => {
    res.send("Hello, World from Vercel!");
});

// Export the app for Vercel (serverless function)
module.exports = app;