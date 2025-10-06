const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json()); // Middleware to parse JSON requests

app.post("/api/webhook", async (req, res) => {
    console.log("Received request:", JSON.stringify(req.body));

    const { event_name, data } = req.body;

    // Handle Rollbar test webhook
    if (event_name === "test") {
        console.log("✅ Test webhook received from Rollbar");
        return res.status(200).json({ message: "Test webhook received successfully!" });
    }

    // Validate actual error payload
    if (!data || !data.item) {
        console.error("❌ Invalid payload structure");
        return res.status(400).json({ error: "Invalid payload - missing data.item" });
    }

    const { level, title, project_id } = data.item;
    const url = data.item.url || "No URL provided";

    // ✅ Use Project Name as Thread Key (fallback to project_id if missing)
    const projectName = data.item.project_name || `Project-${project_id}`;
    const threadKey = `rollbar-${projectName.replace(/\s+/g, "-").toLowerCase()}`;

    // Ignore non-critical errors (optional - uncomment to enable)
    // if (level !== "critical") {
    //     return res.status(200).json({ message: "Ignoring non-critical errors" });
    // }

    // Google Chat Webhook URL
    const GOOGLE_CHAT_WEBHOOK = process.env.GCHAT_WEBHOOK_URL;

    if (!GOOGLE_CHAT_WEBHOOK) {
        console.error("❌ GCHAT_WEBHOOK_URL not configured");
        return res.status(500).json({ error: "Webhook URL not configured" });
    }

    // ✅ IMPORTANT: For incoming webhooks, threadKey MUST be a URL parameter
    const webhookUrlWithThread = `${GOOGLE_CHAT_WEBHOOK}&threadKey=${threadKey}`;

    const message = {
        text: `🚨 *Critical Error in Rollbar* 🚨\n*Project:* ${projectName}\n*Error:* ${title}\n[View Error](${url})`
    };

    try {
        await axios.post(webhookUrlWithThread, message);
        console.log(`✅ Sent to Google Chat thread: ${threadKey}`);
        return res.status(200).json({ message: "Notification sent to Google Chat thread" });
    } catch (error) {
        console.error("❌ Error sending to Google Chat:", error.message);
        return res.status(500).json({ error: "Failed to send notification" });
    }
});

// Default Route for testing
app.get("/", (req, res) => {
    res.send("Hello, World from Vercel!");
});

// Export the app for Vercel (serverless function)
module.exports = app;