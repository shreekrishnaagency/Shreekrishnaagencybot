const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// 🔥 CORS SECURITY FIX
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// ================= 1. CONFIGURATION =================
const TOKEN = "8506639525:AAGLH2uV4A7BXfyYzBBldXIHWSeIAcBZtG0"; 
const ADMIN_ID = "5265106993"; 
const CREATOR_CHANNEL_ID = "-1003501885141"; // Aapki Confirm ki hui ID ✅
const PUBLIC_CHANNEL_ID = "@shreekrishnaIMA"; 

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const CHANNEL_LINK = "https://t.me/shreekrishnaIMA";
const WEBSITE_LINK = "https://shreekrishnaagency.github.io/Business/";
const CREATOR_FORM_LINK = "https://shreekrishnaagency.github.io/Business/join.html";

// ================= 2. MEMORY & DATA =================
let userState = {}; 
let allUsers = new Set(); 
let adminStatus = "ONLINE"; 
let ADMIN_QR_ID = null; 
let orderDB = {};        
let userLatestOrder = {}; 

const RATES = {
  "Instagram": { "Followers": 200, "Likes": 70, "Views": 80 },
  "YouTube":    { "Views": 150, "Likes": 140, "Subs": 2580 },
  "Telegram":   { "Members": 200, "Views": 100 },
  "Facebook":   { "PageLikes": 150, "Reels": 100 },
  "Twitter":    { "Followers": 300, "Likes": 100 }
};

// 🛠️ LINK CLEANER (Ye function crash hone se bachayega)
function escapeMd(text) {
    if (!text) return "";
    return text.toString().replace(/_/g, "\\_").replace(/\*/g, "\\*").replace(/\[/g, "\\[").replace(/`/g, "\\`");
}

// ================= 3. SERVER ROUTES =================
app.get('/', (req, res) => { res.send("🚀 Server Live: Link Crash Fixed!"); });

app.post('/webhook', async (req, res) => {
    const data = req.body;
    console.log("📨 Data Received:", data); 

    try {
        // 1. CHANNEL WELCOME
        if (data.chat_member) {
            const update = data.chat_member;
            if (update.chat.username === "shreekrishnaIMA" || update.chat.id.toString() === PUBLIC_CHANNEL_ID) {
                if (update.new_chat_member.status === "member") {
                    const userName = escapeMd(update.new_chat_member.user.first_name);
                    const sent = await axios.post(`${TELEGRAM_API}/sendMessage`, {
                        chat_id: update.chat.id,
                        text: `👋 **Welcome ${userName} to Shree Krishna Agency!**\n\n🚀 Best SMM Services.\n👇 **Start Here:**\n@ShreeKrishnaAgencyBot`,
                        parse_mode: "Markdown"
                    });
                    if (sent.data.ok) {
                        setTimeout(() => {
                            axios.post(`${TELEGRAM_API}/deleteMessage`, { chat_id: update.chat.id, message_id: sent.data.result.message_id }).catch(e=>{});
                        }, 60000); 
                    }
                }
            }
            return res.send({ status: "ok" });
        }

        // 2. WEBSITE FORM (🔥 FIXED: Added escapeMd)
        if (data.source === "website_join") {
            // Hum data ko clean kar rahe hain taaki _ se error na aaye
            const safeName = escapeMd(data.name);
            const safeLink = escapeMd(data.link);
            const safeSubs = escapeMd(data.subs);

            const msg = `📝 **NEW CREATOR APPLICATION**\n➖➖➖➖➖➖➖➖➖➖\n👤 **Name:** ${safeName}\n📞 **Phone:** [Click to Chat](https://wa.me/${data.phone})\n🔗 **Link:** ${safeLink}\n👥 **Followers:** ${safeSubs}\n💰 **Price:** ₹${data.price}\n➖➖➖➖➖➖➖➖➖➖`;
            
            // Try Sending to Channel
            try {
                await axios.post(`${TELEGRAM_API}/sendMessage`, {
                    chat_id: CREATOR_CHANNEL_ID,
                    text: msg,
                    parse_mode: "Markdown"
                });
            } catch (err) {
                console.error("Channel Post Failed:", err.message);
                // Agar fail ho, tab bhi Admin ko batao
                await sendMessage(ADMIN_ID, `⚠️ **Channel Post Error!**\nCheck Logs. But here is the data:\n${msg}`);
            }

            // Notify Admin
            await sendMessage(ADMIN_ID, `🔔 **New Creator Application Received!**`);
            return res.send({ status: "success" });
        }

        // 3. BOT MESSAGES
        if (data.callback_query) await handleCallback(data.callback_query);
        else if (data.message) await handleMessage(data.message);

    } catch (e) { console.error("Error:", e.message); }
    res.send({ status: "ok" });
});

// HANDLERS
async function handleCallback(cb) {
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const data = cb.data;
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: cb.id });

    if (data === "start") { delete userState[chatId]; await sendMainMenu(chatId, msgId); }
    else if (data === "talk_founder") {
        const userLink = `[${escapeMd(cb.from.first_name)}](tg://user?id=${chatId})`;
        const username = cb.from.username ? `@${escapeMd(cb.from.username)}` : "No Username";
        await sendMessage(ADMIN_ID, `🗣️ **CHAT REQUEST**\nUser: ${userLink}\nHandle: ${username}`);
        await editMessage(chatId, msgId, "✅ **Request Sent!**\nFounder will contact you.", [[{text: "🔙 Back", callback_data: "start"}]]);
    }
    else if (data === "track") {
        userState[chatId] = "TRACKING"; 
        await editMessage(chatId, msgId, "🔎 **Track Order**\n\n👇 Enter **Order ID**:\n(e.g., `ORD-12345`)", [[{text: "🔙 Back", callback_data: "start"}]]);
    }
    // Buttons
    else if (data === "ai") await editMessage(chatId, msgId, `🤖 **AI Status:** ${adminStatus}\nUse 'Talk to Founder' for help.`, [[{text: "🗣️ Talk to Founder", callback_data: "talk_founder"}, {text: "🔙 Back", callback_data: "start"}]]);
    else if (data === "why") await editMessage(chatId, msgId, "🌟 **Why Us?**\n🚀 Fast\n🛡️ Secure\n💎 Best Rates", [[{text: "🔙 Back", callback_data: "start"}]]);
    else if (data === "terms") await editMessage(chatId, msgId, "⚖️ **Terms:**\n✅ Non-Drop\n🚫 No Refunds on Wrong Link", [[{text: "🔙 Back", callback_data: "start"}]]);
    else if (data === "paid") {
        let kb = []; Object.keys(RATES).forEach(k => kb.push([{text: "🌐 " + k, callback_data: "pl_" + k}]));
        kb.push([{text: "🔙 Back", callback_data: "start"}]);
        await editMessage(chatId, msgId, "💎 **Select Platform:**", kb);
    }
    else if (data.startsWith("pl_")) {
        let pl = data.split("_")[1];
        let kb = []; for(let s in RATES[pl]) kb.push([{text: `${s} (₹${RATES[pl][s]})`, callback_data: `sr_${pl}|${s}`}]);
        kb.push([{text: "🔙 Back", callback_data: "paid"}]);
        await editMessage(chatId, msgId, `🚀 **${pl} Services:**`, kb);
    }
    else if (data.startsWith("sr_")) {
        let parts = data.replace("sr_", "").split("|");
        userState[chatId] = `QTY_${parts[0]}|${parts[1]}`;
        await editMessage(chatId, msgId, `✅ **Selected:** ${parts[1]}\n💰 Rate: ₹${RATES[parts[0]][parts[1]]}/1000\n\n🔢 **Enter Quantity (Min 10):**`, [[{text: "❌ Cancel", callback_data: "start"}]]);
    }
    else if (data === "project") {
        let kb = [[{text: "🖥️ Website", callback_data: "pr_Web"}, {text: "📹 Vlog", callback_data: "pr_Vlog"}],[{text: "📝 Content", callback_data: "pr_Cont"}, {text: "🤖 Bot", callback_data: "pr_Bot"}],[{text: "🔙 Back", callback_data: "start"}]];
        await editMessage(chatId, msgId, "🛠 **Select Project:**", kb);
    }
    else if (data.startsWith("pr_")) {
        let type = data.split("_")[1];
        userState[chatId] = `PROJ_${type}`;
        await editMessage(chatId, msgId, `✅ **${type}**\n\n📝 **Type Requirements:**`, [[{text: "❌ Cancel", callback_data: "start"}]]);
    }
}

async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text || "";
    allUsers.add(chatId);

    // ADMIN
    if (chatId.toString() === ADMIN_ID) {
        if (msg.photo && msg.caption === "/setqr") {
            ADMIN_QR_ID = msg.photo[msg.photo.length - 1].file_id;
            await sendMessage(chatId, "✅ **QR Set!**"); return;
        }
        if (text.startsWith("/reply ")) {
            let parts = text.split(" ");
            let uid = parts[1], potentialOid = parts[2], keyword = "", targetOid = null;
            if (potentialOid && potentialOid.startsWith("ORD-")) { targetOid = potentialOid; keyword = parts.slice(3).join(" ").trim(); }
            else { targetOid = userLatestOrder[uid] || "Unknown"; keyword = parts.slice(2).join(" ").trim(); }
            
            const SHORTCUTS = { "rec": "✅ Order Received!", "start": "🚀 Order Started!", "done": "🎉 Order Completed!", "cancel": "❌ Order Cancelled!" };
            if (targetOid !== "Unknown") {
                if(keyword==="rec") orderDB[targetOid]="Received 🟢";
                if(keyword==="start") orderDB[targetOid]="In Progress 🚀";
                if(keyword==="done") orderDB[targetOid]="Completed ✅";
                if(keyword==="cancel") delete orderDB[targetOid];
            }
            let customMsg = SHORTCUTS[keyword.toLowerCase()] || keyword;
            await sendMessage(uid, `📩 **Admin Update:**\n🆔 Order: \`${targetOid}\`\n\n${customMsg}`);
            await sendMessage(chatId, "✅ Reply Sent!"); return;
        }
        // ... Broadcast/Post
        if (text === "/online") { adminStatus = "ONLINE"; await sendMessage(chatId, "🟢 **ONLINE**"); return; }
        if (text === "/offline") { adminStatus = "OFFLINE"; await sendMessage(chatId, "🔴 **OFFLINE**"); return; }
        if (text.startsWith("/broadcast ")) {
            let bMsg = text.replace("/broadcast ", "");
            for(let uid of allUsers) await sendMessage(uid, `📢 **ANNOUNCEMENT**\n\n${bMsg}`);
            await sendMessage(chatId, "✅ Sent!"); return;
        }
        if (text.startsWith("/post ")) {
            await sendMessage(PUBLIC_CHANNEL_ID, text.replace("/post ", ""));
            await sendMessage(chatId, "✅ Posted!"); return;
        }
    }

    if (text === "/start") { delete userState[chatId]; await sendMainMenu(chatId); return; }

    // USER FLOW
    if (userState[chatId]) {
        const state = userState[chatId];
        
        if (state === "TRACKING") {
            let status = orderDB[text.trim()];
            if (status) await sendMessage(chatId, `🔎 **Status:** ${status}`);
            else await sendMessage(chatId, `⚠️ Not Found`);
            delete userState[chatId];
            return;
        }
        
        // 1. QTY
        if (state.startsWith("QTY_")) {
            let qty = parseInt(text);
            if (isNaN(qty) || qty < 10) { await sendMessage(chatId, "⚠️ Invalid (Min 10)"); return; }
            let d = state.replace("QTY_", "").split("|");
            let price = ((RATES[d[0]][d[1]] / 1000) * qty).toFixed(2);
            userState[chatId] = `WAITLINK_${d[0]}|${d[1]}|${qty}|${price}`;
            await sendMessage(chatId, `✅ **Qty:** ${qty}\n💰 **Price:** ₹${price}\n\n🔗 **Send Link:**`);
        }
        
        // 2. LINK (🔥 FIXED: Added escapeMd)
        else if (state.startsWith("WAITLINK_")) {
            if (!text.includes("http")) { await sendMessage(chatId, "⚠️ Invalid Link"); return; }
            let d = state.replace("WAITLINK_", "").split("|");
            let oid = "ORD-" + Math.floor(10000 + Math.random() * 90000);
            orderDB[oid] = "Pending Payment 🟡"; userLatestOrder[chatId] = oid;
            
            const userLink = `[${escapeMd(msg.from.first_name)}](tg://user?id=${chatId})`;
            const safeLink = escapeMd(text); // Clean link for Admin msg

            // NOTIFY ADMIN
            await sendMessage(ADMIN_ID, `🚀 **NEW ORDER (Pending)**\n🆔 \`${oid}\`\n👤 ${userLink}\n💰 ₹${d[3]}\n🔗 ${safeLink}`);

            userState[chatId] = `WAITSCR_${d[0]}|${d[1]}|${d[2]}|${d[3]}|${text}|${oid}`;
            if (ADMIN_QR_ID) await sendPhoto(chatId, ADMIN_QR_ID, `💰 **Created: ${oid}**\nScan QR & Send Screenshot.`);
            else await sendMessage(chatId, "⚠️ QR Missing. Pay & Send Screenshot.");
        }

        // 3. SCREENSHOT
        else if (state.startsWith("WAITSCR_")) {
            if (!msg.photo) { await sendMessage(chatId, "⚠️ Send Photo"); return; }
            let d = state.replace("WAITSCR_", "").split("|");
            let oid = d[5];
            const userLink = `[${escapeMd(msg.from.first_name)}](tg://user?id=${chatId})`;
            
            await sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, `📸 **PROOF**\n🆔 \`${oid}\`\n👤 ${userLink}\n💰 ₹${d[3]}`);
            await sendMessage(chatId, `✅ **Received!**\nID: \`${oid}\`\nVerifying...`);
            delete userState[chatId];
        }

        else if (state.startsWith("PROJ_")) {
             let type = state.replace("PROJ_", "");
             let pid = "PRJ-" + Math.floor(1000 + Math.random() * 9000);
             const userLink = `[${escapeMd(msg.from.first_name)}](tg://user?id=${chatId})`;
             await sendMessage(ADMIN_ID, `🌐 **PROJECT**\nUser: ${userLink}\nType: ${type}\nMsg: ${escapeMd(text)}`);
             await sendMessage(chatId, `✅ Request Saved!`);
             delete userState[chatId];
        }
    }
}

async function sendMessage(chatId, text, kb) { try { await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: "Markdown", reply_markup: kb ? {inline_keyboard: kb} : undefined }); } catch(e){} }
async function sendPhoto(chatId, photo, caption) { try { await axios.post(`${TELEGRAM_API}/sendPhoto`, { chat_id: chatId, photo: photo, caption: caption, parse_mode: "Markdown" }); } catch(e){} }
async function editMessage(chatId, msgId, text, kb) { try { await axios.post(`${TELEGRAM_API}/editMessageText`, { chat_id: chatId, message_id: msgId, text: text, parse_mode: "Markdown", reply_markup: {inline_keyboard: kb} }); } catch(e){} }
async function sendMainMenu(chatId, msgId) {
    const kb = [ [{text: "💰 Paid Services", callback_data: "paid"}, {text: "🌐 Project Working", callback_data: "project"}], [{text: "📢 Join Channel", url: CHANNEL_LINK}, {text: "📝 Join as Creator", url: CREATOR_FORM_LINK}], [{text: "🌟 Why Us?", callback_data: "why"}, {text: "⚖️ Terms", callback_data: "terms"}], [{text: "🤖 AI Support", callback_data: "ai"}, {text: "🔎 Track Order", callback_data: "track"}], [{text: "🗣️ Talk to Founder", callback_data: "talk_founder"}, {text: "🌐 Website", url: WEBSITE_LINK}] ];
    if(msgId) await editMessage(chatId, msgId, "👋 **Welcome!** Choose service:", kb); else await sendMessage(chatId, "👋 **Welcome!** Choose service:", kb);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
