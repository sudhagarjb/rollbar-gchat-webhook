const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json()); // Middleware to parse JSON requests

app.post("/api/webhook", async (req, res) => {
    console.log("Received request:", JSON.stringify(req.body));

    const { data } = req.body;
    if (!data || !data.item) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    const { level, title, project_id } = data.item;
    const url = data.item.url || "No URL provided";

    // ✅ Use Project Name as Thread Key (fallback to project_id if missing)
    const projectName = data.item.project_name || `Project-${project_id}`;
    const threadKey = `rollbar-${projectName.replace(/\s+/g, "-").toLowerCase()}`;

      // Ignore non-critical errors
  // if (level !== "critical") {
  //     return res.status(200).json({ message: "Ignoring non-critical errors" });
  // }

    // Google Chat Webhook URL
    const GOOGLE_CHAT_WEBHOOK = process.env.GCHAT_WEBHOOK_URL;

    const message = {
        text: `🚨 *Critical Error in Rollbar* 🚨\n*Project:* ${projectName}\n*Error:* ${title}\n[View Error](${url})`,
        thread: { threadKey } // Keeps messages in the same thread
    };

    try {
        await axios.post(GOOGLE_CHAT_WEBHOOK, message);
        return res.status(200).json({ message: "Notification sent to Google Chat thread" });
    } catch (error) {
        console.error("Error sending message:", error);
        return res.status(500).json({ error: "Failed to send notification" });
    }
});

// Default Route for testing
app.get("/", (req, res) => {
    res.send("Hello, World from Vercel!");
});

// Export the app for Vercel (serverless function)
module.exports = app;