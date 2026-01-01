const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// 👇 APNA BOT TOKEN YAHAN DALEIN
const TOKEN = "8506639525:AAGLH2uV4A7BXfyYzBBldXIHWSeIAcBZtG0"; 
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = "5265106993"; // Aapka ID

// 1. Uptime Check (Browser mein ye dikhega)
app.get('/', (req, res) => {
    res.send("🚀 Server is Running! Bot Active hai.");
});

// 2. Telegram Webhook (Message yahan aayega)
app.post('/webhook', async (req, res) => {
    const update = req.body;

    // Check karein ki message hai ya nahi
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const name = update.message.from.first_name;

        console.log(`Msg from ${name}: ${text}`);

        // --- BOT LOGIC YAHAN HAI ---
        if (text === "/start") {
            await sendMessage(chatId, `👋 Hello ${name}! Main aapke Naye Server se bol raha hoon.`);
        } else if (text === "/online") {
            await sendMessage(chatId, "🟢 **Status: ONLINE** (Powered by Render)");
        } else {
            await sendMessage(chatId, "Samajh gaya Boss! Aapne kaha: " + text);
        }
    }
    res.send({ status: "ok" });
});

// Message bhejne ka function
async function sendMessage(chatId, text) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: "Markdown"
        });
    } catch (e) {
        console.error("Error sending message:", e.message);
    }
}

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
