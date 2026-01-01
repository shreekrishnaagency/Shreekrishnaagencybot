const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// ================= 1. CONFIGURATION =================
const TOKEN = "8506639525:AAGLH2uV4A7BXfyYzBBldXIHWSeIAcBZtG0"; 
const ADMIN_ID = "5265106993"; 
const CREATOR_CHANNEL_ID = "-1003501885141"; // Secret Channel
const PUBLIC_CHANNEL_ID = "@shreekrishnaIMA"; 

// BACKUP QR (Jo GitHub par upload kiya hai)
const BACKUP_QR_LINK = "https://shreekrishnaagency.github.io/Business/qr.jpg";

// LINKS
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const CHANNEL_LINK = "https://t.me/shreekrishnaIMA";
const WEBSITE_LINK = "https://shreekrishnaagency.github.io/Business/";
const CREATOR_FORM_LINK = "https://shreekrishnaagency.github.io/Business/join.html";

// ================= 2. MEMORY & DATA =================
let userState = {}; 
let allUsers = new Set(); 
let adminStatus = "ONLINE"; 
let ADMIN_QR_ID = null; // Yahan /setqr wala photo save hoga

const RATES = {
  "Instagram": { "Followers": 200, "Likes": 70, "Views": 80 },
  "YouTube":    { "Views": 150, "Likes": 140, "Subs": 2580 },
  "Telegram":   { "Members": 200, "Views": 100 },
  "Facebook":   { "PageLikes": 150, "Reels": 100 },
  "Twitter":    { "Followers": 300, "Likes": 100 }
};

// ================= 3. SERVER ROUTES =================
app.get('/', (req, res) => { res.send("🚀 Server Live: QR Mode Active!"); });

app.post('/webhook', async (req, res) => {
    const data = req.body;
    try {
        // ➤ WEBSITE DATA HANDLING
        if (data.source === "website_join") {
            const msg = `📝 **NEW CREATOR APPLICATION**\n` +
                        `➖➖➖➖➖➖➖➖➖➖\n` +
                        `👤 **Name:** ${data.name}\n` +
                        `📞 **Phone:** [Click to Chat](https://wa.me/${data.phone})\n` +
                        `🔗 **Link:** ${data.link}\n` +
                        `👥 **Followers:** ${data.subs}\n` +
                        `💰 **Price:** ₹${data.price}\n` +
                        `💳 **Payment:** ${data.payment_id || "N/A"}\n` +
                        `➖➖➖➖➖➖➖➖➖➖`;

            // Send to Secret Channel
            await sendMessage(CREATOR_CHANNEL_ID, msg);
            // Notify Admin
            await sendMessage(ADMIN_ID, `🔔 **New Creator Application!**\nCheck Secret Channel.`);
            
            return res.send({ status: "success" });
        }

        // ➤ TELEGRAM BOT HANDLING
        if (data.callback_query) await handleCallback(data.callback_query);
        else if (data.message) await handleMessage(data.message);

    } catch (e) { console.error("Error:", e.message); }
    res.send({ status: "ok" });
});

// ================= 4. LOGIC HANDLERS =================
async function handleCallback(cb) {
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const data = cb.data;
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: cb.id });

    if (data === "start") { delete userState[chatId]; await sendMainMenu(chatId, msgId); }
    
    // SUPPORT & INFO
    else if (data === "talk_founder") {
        await sendMessage(ADMIN_ID, `🗣️ **CHAT REQ**\nUser: ${cb.from.first_name} (ID: \`${chatId}\`)`);
        await editMessage(chatId, msgId, "✅ **Request Sent!**\nThe Founder will message you shortly.", [[{text: "🔙 Back", callback_data: "start"}]]);
    }
    else if (data === "ai") {
        let st = (adminStatus === "ONLINE") ? "🟢 **Online**" : "🔴 **Offline**";
        await editMessage(chatId, msgId, `🤖 **AI Support Status:** ${st}\n\nFor urgent queries, use 'Talk to Founder'.`, [[{text: "🗣️ Talk to Founder", callback_data: "talk_founder"}, {text: "🔙 Back", callback_data: "start"}]]);
    }
    else if (data === "track") await editMessage(chatId, msgId, "🔎 **Track Order**\n\nPlease send your **Order ID** here.", [[{text: "🔙 Back", callback_data: "start"}]]);
    else if (data === "why") await editMessage(chatId, msgId, "🌟 **Why Choose Us?**\n\n🚀 Super Fast Delivery\n🛡️ 100% Secure\n💎 Best Market Rates", [[{text: "🔙 Back", callback_data: "start"}]]);
    else if (data === "terms") await editMessage(chatId, msgId, "⚖️ **Terms:**\n\n✅ Non-Drop Guaranteed\n🚫 No Refunds for Wrong Links", [[{text: "🔙 Back", callback_data: "start"}]]);

    // PAID SERVICES
    else if (data === "paid") {
        let kb = []; Object.keys(RATES).forEach(k => kb.push([{text: "🌐 " + k, callback_data: "pl_" + k}]));
        kb.push([{text: "🔙 Back", callback_data: "start"}]);
        await editMessage(chatId, msgId, "💎 **Select a Platform:**", kb);
    }
    else if (data.startsWith("pl_")) {
        let pl = data.split("_")[1];
        if (RATES[pl]) {
            let kb = []; for(let s in RATES[pl]) kb.push([{text: `${s} (₹${RATES[pl][s]})`, callback_data: `sr_${pl}|${s}`}]);
            kb.push([{text: "🔙 Back", callback_data: "paid"}]);
            await editMessage(chatId, msgId, `🚀 **${pl} Services:**`, kb);
        }
    }
    else if (data.startsWith("sr_")) {
        let parts = data.replace("sr_", "").split("|");
        userState[chatId] = `QTY_${parts[0]}|${parts[1]}`;
        await editMessage(chatId, msgId, `✅ **Selected:** ${parts[1]}\n💰 Rate: ₹${RATES[parts[0]][parts[1]]}/1000\n\n🔢 **Enter Quantity (Min 10):**`, [[{text: "❌ Cancel", callback_data: "start"}]]);
    }
    
    // PROJECTS
    else if (data === "project") {
        let kb = [[{text: "🖥️ Website", callback_data: "pr_Web"}, {text: "📹 Vlog", callback_data: "pr_Vlog"}],[{text: "📝 Content", callback_data: "pr_Cont"}, {text: "🤖 Bot", callback_data: "pr_Bot"}],[{text: "🔙 Back", callback_data: "start"}]];
        await editMessage(chatId, msgId, "🛠 **Select Project Type:**", kb);
    }
    else if (data.startsWith("pr_")) {
        let type = data.split("_")[1];
        userState[chatId] = `PROJ_${type}`;
        await editMessage(chatId, msgId, `✅ **${type}**\n\n📝 **Please type your requirements:**`, [[{text: "❌ Cancel", callback_data: "start"}]]);
    }
}

async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text || "";
    allUsers.add(chatId);

    // --- ADMIN COMMANDS ---
    if (chatId.toString() === ADMIN_ID) {
        
        // 🔥 SET QR COMMAND
        if (msg.photo && (msg.caption === "/setqr")) {
            ADMIN_QR_ID = msg.photo[msg.photo.length - 1].file_id;
            await sendMessage(chatId, "✅ **New QR Code Set!**\nUsers will now see this photo.");
            return;
        }

        if (text === "/online") { adminStatus = "ONLINE"; await sendMessage(chatId, "🟢 **ONLINE**"); return; }
        if (text === "/offline") { adminStatus = "OFFLINE"; await sendMessage(chatId, "🔴 **OFFLINE**"); return; }
        if (text.startsWith("/broadcast ")) {
            let bMsg = text.replace("/broadcast ", "");
            for(let uid of allUsers) await sendMessage(uid, `📢 **ANNOUNCEMENT**\n\n${bMsg}`);
            await sendMessage(chatId, "✅ Broadcast Sent!"); return;
        }
        if (text.startsWith("/reply ")) {
            let parts = text.split(" ");
            let uid = parts[1];
            let rMsg = parts.slice(2).join(" ");
            await sendMessage(uid, `📩 **Admin Reply:**\n${rMsg}`);
            await sendMessage(chatId, "✅ Reply Sent!"); return;
        }
        if (text.startsWith("/post ")) {
            await sendMessage(PUBLIC_CHANNEL_ID, text.replace("/post ", ""));
            await sendMessage(chatId, "✅ Posted!"); return;
        }
    }

    // --- USER FLOW ---
    if (text === "/start") { delete userState[chatId]; await sendMainMenu(chatId); return; }
    if (text === "/myid") { await sendMessage(chatId, `🆔 Your ID: \`${chatId}\``); return; }

    // --- USER INPUTS ---
    if (userState[chatId]) {
        const state = userState[chatId];
        
        // 1. QUANTITY ENTERED -> SEND QR CODE
        if (state.startsWith("QTY_")) {
            let qty = parseInt(text);
            if (isNaN(qty) || qty < 10) { await sendMessage(chatId, "⚠️ Invalid Number (Min 10)"); return; }
            
            let d = state.replace("QTY_", "").split("|");
            let price = ((RATES[d[0]][d[1]] / 1000) * qty).toFixed(2);
            userState[chatId] = `LINK_${d[0]}|${d[1]}|${qty}|${price}`;
            
            const caption = `📊 **Order Summary**\n` +
                            `➖➖➖➖➖➖➖➖\n` +
                            `🛠 **Service:** ${d[1]}\n` +
                            `🔢 **Quantity:** ${qty}\n` +
                            `💰 **Total Amount:** ₹${price}\n` +
                            `➖➖➖➖➖➖➖➖\n\n` +
                            `📸 **Scan QR to Pay Now**\n` +
                            `✅ After payment, please **Send the Link/Screenshot** below.`;

            // Send Custom QR or Backup QR
            if (ADMIN_QR_ID) {
                await sendPhoto(chatId, ADMIN_QR_ID, caption);
            } else {
                await sendPhoto(chatId, BACKUP_QR_LINK, caption);
            }
        }
        
        // 2. LINK ENTERED -> CONFIRM ORDER
        else if (state.startsWith("LINK_")) {
            let d = state.replace("LINK_", "").split("|");
            let oid = "ORD-" + Math.floor(10000 + Math.random() * 90000);
            delete userState[chatId];
            
            await sendMessage(ADMIN_ID, `🚀 **NEW PAID ORDER**\n🆔 \`${oid}\`\n👤 ${msg.from.first_name}\n📦 ${d[1]}\n💰 ₹${d[3]}\n🔗 ${text}\n⚠️ *Verify Payment in App*`);
            await sendMessage(chatId, `✅ **Order Received!**\n🆔 ID: \`${oid}\`\n\nAdmin will verify payment & start shortly.`);
        }
        
        // 3. PROJECT REQUEST
        else if (state.startsWith("PROJ_")) {
            let type = state.replace("PROJ_", "");
            delete userState[chatId];
            await sendMessage(ADMIN_ID, `🌐 **PROJECT REQUEST**\nType: ${type}\nMsg: ${text}`);
            await sendMessage(chatId, "✅ **Saved!** Team will contact you.");
        }
    }
}

// ================= 5. HELPERS =================
async function sendMessage(chatId, text, kb) {
    try { await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: "Markdown", reply_markup: kb ? {inline_keyboard: kb} : undefined, disable_web_page_preview: true }); } catch(e){ console.log("SendMsg Error"); }
}

async function sendPhoto(chatId, photo, caption) {
    try { await axios.post(`${TELEGRAM_API}/sendPhoto`, { chat_id: chatId, photo: photo, caption: caption, parse_mode: "Markdown" }); } catch(e){ console.log("SendPhoto Error:", e.message); }
}

async function editMessage(chatId, msgId, text, kb) {
    try { await axios.post(`${TELEGRAM_API}/editMessageText`, { chat_id: chatId, message_id: msgId, text: text, parse_mode: "Markdown", reply_markup: {inline_keyboard: kb}, disable_web_page_preview: true }); } catch(e){}
}

async function sendMainMenu(chatId, msgId) {
    const kb = [
        [{text: "💰 Paid Services", callback_data: "paid"}, {text: "🌐 Project Working", callback_data: "project"}],
        [{text: "📢 Join Channel", url: CHANNEL_LINK}, {text: "📝 Join as Creator", url: CREATOR_FORM_LINK}],
        [{text: "🌟 Why Us?", callback_data: "why"}, {text: "⚖️ Terms", callback_data: "terms"}],
        [{text: "🤖 AI Support", callback_data: "ai"}, {text: "🔎 Track Order", callback_data: "track"}],
        [{text: "🗣️ Talk to Founder", callback_data: "talk_founder"}, {text: "🌐 Website", url: WEBSITE_LINK}]
    ];
    const txt = "👋 **Welcome to Shree Krishna Agency!** 🚀\n\n_Choose a service below:_";
    if(msgId) await editMessage(chatId, msgId, txt, kb);
    else await sendMessage(chatId, txt, kb);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
