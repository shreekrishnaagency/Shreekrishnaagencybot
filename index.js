const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// ================= 1. CONFIGURATION (APNI DETAILS DALEIN) =================
const TOKEN = "8506639525:AAGLH2uV4A7BXfyYzBBldXIHWSeIAcBZtG0"; // Bot Token
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

const ADMIN_ID = "5265106993"; // Aapka Admin ID
const CHANNEL_ID = "@shreekrishnaIMA"; // Aapka Channel Username
const CHANNEL_LINK = "https://t.me/shreekrishnaIMA";
const WEBSITE_LINK = "https://shreekrishnaagency.github.io/Business/";
const CREATOR_FORM_LINK = "https://shreekrishnaagency.github.io/Business/join.html";

// ================= 2. DATA STORAGE (MEMORY) =================
// Note: Render restart hone par ye reset ho jata hai
let userState = {}; // Users ka current step (Order process)
let allUsers = new Set(); // Broadcast ke liye users ki list
let adminStatus = "OFFLINE"; // Default Status

// Rates Configuration
const RATES = {
  "Instagram": { "Followers": 200, "Likes": 70, "Views": 80 },
  "YouTube":    { "Views": 150, "Likes": 140, "Subs": 2580 },
  "Telegram":   { "Members": 200, "Views": 100 },
  "Facebook":   { "PageLikes": 150, "Reels": 100 },
  "Twitter":    { "Followers": 300, "Likes": 100 }
};

// ================= 3. SERVER ROUTES =================

// Check Server Health
app.get('/', (req, res) => {
    res.send("🚀 Shree Krishna Agency Server is Running 24/7!");
});

// MAIN WEBHOOK (Telegram + Website Data Yahan Aayega)
app.post('/webhook', async (req, res) => {
    const data = req.body;

    try {
        // ➤ CASE A: WEBSITE SE DATA AAYA HAI (join.html)
        if (data.source === "website_join") {
            const payInfo = data.payment_id ? `\n💳 **Paid:** ${data.payment_id}` : "\n⚠️ **Payment:** Pending/Not Integrated";
            
            const msg = `📝 **WEBSITE JOINING**\n\n👤 Name: ${data.name}\n📞 Phone: ${data.phone}\n🔗 Link: ${data.link}\n👥 Subs: ${data.subs}\n💰 Offer Price: ₹${data.price}${payInfo}`;
            
            await sendMessage(ADMIN_ID, msg);
            return res.send({ status: "success" });
        }

        // ➤ CASE B: TELEGRAM MESSAGE AAYA HAI
        if (data.callback_query) {
            await handleCallback(data.callback_query);
        } else if (data.message) {
            await handleMessage(data.message);
        }

    } catch (e) {
        console.error("Error:", e.message);
    }

    res.send({ status: "ok" });
});

// ================= 4. HANDLERS (LOGIC) =================

// Handle Button Clicks
async function handleCallback(cb) {
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const data = cb.data;

    // Loading Circle Hatayein
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: cb.id });

    if (data === "start") {
        delete userState[chatId];
        await sendMainMenu(chatId, msgId);
    }
    // Talk to Founder
    else if (data === "talk_founder") {
        const userLink = `tg://user?id=${cb.from.id}`;
        await sendMessage(ADMIN_ID, `🗣️ **CHAT REQUEST**\n👤 User: [${cb.from.first_name}](${userLink})\n🆔 ID: \`${chatId}\`\n⚠️ Boss, ye user aapse baat karna chahta hai.`);
        await editMessage(chatId, msgId, "✅ **Request Sent!**\nFounder aapko jald hi message karenge.", [[{text: "🔙 Back", callback_data: "start"}]]);
    }
    // Paid Services Menu
    else if (data === "paid") {
        let kb = [];
        Object.keys(RATES).forEach(k => kb.push([{text: "🌐 " + k, callback_data: "pl_" + k}]));
        kb.push([{text: "🔙 Back", callback_data: "start"}]);
        await editMessage(chatId, msgId, "💎 **Select Platform:**", kb);
    }
    // Select Platform
    else if (data.startsWith("pl_")) {
        let pl = data.split("_")[1];
        if (RATES[pl]) {
            let kb = [];
            for(let s in RATES[pl]) kb.push([{text: `${s} (₹${RATES[pl][s]})`, callback_data: `sr_${pl}|${s}`}]);
            kb.push([{text: "🔙 Back", callback_data: "paid"}]);
            await editMessage(chatId, msgId, `🚀 **${pl}** Services:\nRate per 1000:`, kb);
        }
    }
    // Select Service -> Ask Quantity
    else if (data.startsWith("sr_")) {
        let parts = data.replace("sr_", "").split("|");
        userState[chatId] = `QTY_${parts[0]}|${parts[1]}`;
        await editMessage(chatId, msgId, `✅ **Selected:** ${parts[1]}\n💰 Rate: ₹${RATES[parts[0]][parts[1]]}/1000\n\n🔢 **Quantity likhein (Min 10):**`, [[{text: "❌ Cancel", callback_data: "start"}]]);
    }
    // Project Menu
    else if (data === "project") {
        let kb = [[{text: "🖥️ Website", callback_data: "pr_Web"}, {text: "📹 Vlog", callback_data: "pr_Vlog"}],[{text: "📝 Content", callback_data: "pr_Cont"}, {text: "🤖 Bot", callback_data: "pr_Bot"}],[{text: "🔙 Back", callback_data: "start"}]];
        await editMessage(chatId, msgId, "🛠 **Select Project Type:**", kb);
    }
    // Select Project
    else if (data.startsWith("pr_")) {
        let type = data.split("_")[1];
        userState[chatId] = `PROJ_${type}`;
        await editMessage(chatId, msgId, `✅ Selected: **${type}**\n\n📝 **Requirements aur Budget likh kar bhejein:**`, [[{text: "❌ Cancel", callback_data: "start"}]]);
    }
    // AI Support Status
    else if (data === "ai") {
        let statusTxt = (adminStatus === "ONLINE") ? "🟢 **Admin is ONLINE!**" : "🔴 **Admin is OFFLINE.**";
        await editMessage(chatId, msgId, `${statusTxt}\n\nAgar urgent hai toh 'Talk to Founder' dabayein.`, [[{text: "🗣️ Chat Request", callback_data: "talk_founder"}, {text: "🔙 Back", callback_data: "start"}]]);
    }
    // Track Order
    else if (data === "track") {
        await editMessage(chatId, msgId, "🔎 **Track Order**\n\nAdmin ko apna Order ID message karein.", [[{text: "🔙 Back", callback_data: "start"}]]);
    }
    // Why Us / Terms
    else if (data === "why") await editMessage(chatId, msgId, "🌟 **Why Us?**\n\n🚀 Super Fast Delivery\n🛡️ 100% Secure\n💎 Best Market Rates", [[{text: "🔙 Back", callback_data: "start"}]]);
    else if (data === "terms") await editMessage(chatId, msgId, "⚖️ **Terms:**\n\n✅ 24-72 Hrs Delivery\n✅ Non-Drop Guaranteed\n🚫 No Refunds on Wrong Link", [[{text: "🔙 Back", callback_data: "start"}]]);
}

// Handle Text Messages & Commands
async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text || "";
    const name = msg.from.first_name;

    // Save User for Broadcast
    allUsers.add(chatId);

    // --- 1. ADMIN COMMANDS ---
    if (chatId.toString() === ADMIN_ID) {
        // Status Commands
        if (text === "/online") { adminStatus = "ONLINE"; await sendMessage(chatId, "🟢 **Status Updated: ONLINE**"); return; }
        if (text === "/offline") { adminStatus = "OFFLINE"; await sendMessage(chatId, "🔴 **Status Updated: OFFLINE**"); return; }
        if (text === "/myid") { await sendMessage(chatId, `🆔 Your ID: \`${chatId}\``); return; }

        // Broadcast Command (/broadcast Hello World)
        if (text.startsWith("/broadcast ")) {
            const bMsg = text.replace("/broadcast ", "");
            let count = 0;
            for (let uid of allUsers) {
                await sendMessage(uid, `📢 **ANNOUNCEMENT**\n\n${bMsg}`);
                count++;
            }
            await sendMessage(chatId, `✅ Broadcast sent to ${count} active users.`);
            return;
        }

        // Reply Command (/reply 12345 Hello)
        if (text.startsWith("/reply ")) {
            const parts = text.split(" ");
            const uId = parts[1];
            const rMsg = parts.slice(2).join(" ");
            if (uId && rMsg) {
                await sendMessage(uId, `📩 **Admin Reply:**\n\n${rMsg}`);
                await sendMessage(chatId, "✅ Reply Sent!");
            } else {
                await sendMessage(chatId, "⚠️ Usage: `/reply UserID Message`");
            }
            return;
        }

        // Post to Channel (/post This is a test)
        // A. TEXT POST
        if (text.startsWith("/post ")) {
            const pMsg = text.replace("/post ", "");
            await sendMessage(CHANNEL_ID, pMsg);
            await sendMessage(chatId, "✅ Text Posted to Channel!");
            return;
        }
        // B. PHOTO POST
        if (msg.photo && (msg.caption || "").startsWith("/post")) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            const cap = msg.caption.replace("/post", "").trim();
            await sendPhoto(CHANNEL_ID, photoId, cap);
            await sendMessage(chatId, "✅ Photo Posted to Channel!");
            return;
        }
    }

    // --- 2. USER COMMANDS ---
    if (text === "/start") {
        delete userState[chatId];
        await sendMainMenu(chatId);
        return;
    }

    // --- 3. STATE MACHINE (Inputs) ---
    if (userState[chatId]) {
        const state = userState[chatId];

        // Quantity Check
        if (state.startsWith("QTY_")) {
            let qty = parseInt(text);
            if (isNaN(qty) || qty < 10) {
                await sendMessage(chatId, "⚠️ **Invalid Number!** (Min 10)");
            } else {
                let d = state.replace("QTY_", "").split("|");
                let price = ((RATES[d[0]][d[1]] / 1000) * qty).toFixed(2);
                userState[chatId] = `LINK_${d[0]}|${d[1]}|${qty}|${price}`;
                await sendMessage(chatId, `📊 **Order Summary**\n\nService: ${d[1]}\nQty: ${qty}\n💰 Price: ₹${price}\n\n🔗 **Ab Link Bhejein:**`);
            }
        }
        // Link Check & Final Order
        else if (state.startsWith("LINK_")) {
            if (!text.includes(".")) {
                await sendMessage(chatId, "⚠️ **Invalid Link!** Sahi link bhejein.");
                return;
            }
            let d = state.replace("LINK_", "").split("|");
            let oid = "ORD-" + Math.floor(100000 + Math.random() * 900000);
            delete userState[chatId];

            // Notify Admin
            await sendMessage(ADMIN_ID, `🚀 **NEW ORDER (BOT)**\n🆔 \`${oid}\`\n👤 ${name} (\`${chatId}\`)\n📦 ${d[1]} (${d[0]})\n📊 Qty: ${d[2]}\n💰 ₹${d[3]}\n🔗 ${text}`);
            
            // Notify User
            await sendMessage(chatId, `✅ **Order Received!**\n🆔 ID: \`${oid}\`\n\nAdmin will verify and start shortly.`);
        }
        // Project Details
        else if (state.startsWith("PROJ_")) {
            let type = state.replace("PROJ_", "");
            delete userState[chatId];
            await sendMessage(ADMIN_ID, `🌐 **PROJECT ENQUIRY**\nType: ${type}\nUser: ${name} (\`${chatId}\`)\nMsg: ${text}`);
            await sendMessage(chatId, "✅ **Requirements Saved!**\nTeam will contact you soon.");
        }
    }
}

// ================= 5. HELPER FUNCTIONS =================

async function sendMessage(chatId, text, kb) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: "Markdown",
            reply_markup: kb ? { inline_keyboard: kb } : undefined,
            disable_web_page_preview: true
        });
    } catch (e) { console.error("SendMsg Error:", e.message); }
}

async function editMessage(chatId, msgId, text, kb) {
    try {
        await axios.post(`${TELEGRAM_API}/editMessageText`, {
            chat_id: chatId,
            message_id: msgId,
            text: text,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: kb },
            disable_web_page_preview: true
        });
    } catch (e) { console.error("EditMsg Error:", e.message); }
}

async function sendPhoto(chatId, photoId, caption) {
    try {
        await axios.post(`${TELEGRAM_API}/sendPhoto`, {
            chat_id: chatId,
            photo: photoId,
            caption: caption,
            parse_mode: "Markdown"
        });
    } catch (e) { console.error("SendPhoto Error:", e.message); }
}

async function sendMainMenu(chatId, msgId) {
    const kb = [
        [{text: "💰 Paid Services", callback_data: "paid"}, {text: "🌐 Project Working", callback_data: "project"}],
        [{text: "🌟 Why Us?", callback_data: "why"}, {text: "⚖️ Terms", callback_data: "terms"}],
        [{text: "📢 Join Channel", url: CHANNEL_LINK}, {text: "📝 Join as Creator", url: CREATOR_FORM_LINK}],
        [{text: "🤖 AI Support", callback_data: "ai"}, {text: "🔎 Track Order", callback_data: "track"}],
        [{text: "🗣️ Talk to Founder", callback_data: "talk_founder"}, {text: "🌐 Website", url: WEBSITE_LINK}]
    ];
    const txt = "👋 **Welcome to Shree Krishna Agency!** 🚀\nChoose a service below:";
    
    if (msgId) await editMessage(chatId, msgId, txt, kb);
    else await sendMessage(chatId, txt, kb);
}

// ================= 6. START SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
