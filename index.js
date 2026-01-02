const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// ================= 1. CONFIGURATION =================
const TOKEN = "8506639525:AAGLH2uV4A7BXfyYzBBldXIHWSeIAcBZtG0"; 
const ADMIN_ID = "5265106993"; 
const CREATOR_CHANNEL_ID = "-1003501885141"; 
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

// TRACKING DATABASE
let orderDB = {};        
let userLatestOrder = {}; 

const RATES = {
  "Instagram": { "Followers": 200, "Likes": 70, "Views": 80 },
  "YouTube":    { "Views": 150, "Likes": 140, "Subs": 2580 },
  "Telegram":   { "Members": 200, "Views": 100 },
  "Facebook":   { "PageLikes": 150, "Reels": 100 },
  "Twitter":    { "Followers": 300, "Likes": 100 }
};

// ================= 3. SERVER ROUTES =================
app.get('/', (req, res) => { res.send("🚀 Server is Running 100%!"); });

app.post('/webhook', async (req, res) => {
    const data = req.body;
    
    // 🛠️ DEBUG LOG (Render Logs mein dikhega agar website se data aaya)
    if(data.source === "website_join") console.log("📩 New Website Form Received:", data.name);

    try {
        // ➤ 1. CHANNEL WELCOME MESSAGE (Auto Delete)
        if (data.chat_member) {
            const update = data.chat_member;
            if (update.chat.username === "shreekrishnaIMA" || update.chat.id.toString() === PUBLIC_CHANNEL_ID) {
                if (update.new_chat_member.status === "member") {
                    const userName = update.new_chat_member.user.first_name;
                    const welcomeMsg = `👋 **Welcome ${userName} to Shree Krishna Agency!**\n\n🚀 Best SMM Services at Cheapest Rates.\n👇 **Start Order Here:**\n@ShreeKrishnaAgencyBot`;
                    
                    const sent = await axios.post(`${TELEGRAM_API}/sendMessage`, {
                        chat_id: update.chat.id,
                        text: welcomeMsg,
                        parse_mode: "Markdown"
                    });

                    if (sent.data.ok) {
                        setTimeout(() => {
                            axios.post(`${TELEGRAM_API}/deleteMessage`, {
                                chat_id: update.chat.id,
                                message_id: sent.data.result.message_id
                            }).catch(e => console.log("Delete Error"));
                        }, 60000); 
                    }
                }
            }
            return res.send({ status: "ok" });
        }

        // ➤ 2. WEBSITE FORM HANDLING
        if (data.source === "website_join") {
            const msg = `📝 **NEW CREATOR APPLICATION**\n➖➖➖➖➖➖➖➖➖➖\n👤 **Name:** ${data.name}\n📞 **Phone:** [Click to Chat](https://wa.me/${data.phone})\n🔗 **Link:** ${data.link}\n👥 **Followers:** ${data.subs}\n💰 **Price:** ₹${data.price}\n💳 **Payment:** ${data.payment_id || "N/A"}\n➖➖➖➖➖➖➖➖➖➖`;
            
            // Send to Secret Channel
            await sendMessage(CREATOR_CHANNEL_ID, msg);
            // Notify Admin
            await sendMessage(ADMIN_ID, `🔔 **New Creator Application Received!**\nCheck your Secret Channel.`);
            
            return res.send({ status: "success" });
        }

        // ➤ 3. TELEGRAM BOT HANDLER
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
    
    // 🔥 TALK TO FOUNDER
    else if (data === "talk_founder") {
        const userLink = `[${cb.from.first_name}](tg://user?id=${chatId})`;
        const username = cb.from.username ? `@${cb.from.username}` : "No Username";
        await sendMessage(ADMIN_ID, `🗣️ **CHAT REQUEST**\n➖➖➖➖➖➖➖➖\n👤 **User:** ${userLink}\n🆔 **ID:** \`${chatId}\`\n🔗 **Handle:** ${username}\n➖➖➖➖➖➖➖➖\nUser wants to talk.`);
        await editMessage(chatId, msgId, "✅ **Request Sent!**\nThe Founder will message you shortly.", [[{text: "🔙 Back", callback_data: "start"}]]);
    }

    else if (data === "track") {
        userState[chatId] = "TRACKING"; 
        await editMessage(chatId, msgId, "🔎 **Track Order**\n\n👇 Please enter your **Order ID** below:\n(Example: `ORD-12345`)", [[{text: "🔙 Back", callback_data: "start"}]]);
    }
    
    // INFO BUTTONS
    else if (data === "ai") {
        let st = (adminStatus === "ONLINE") ? "🟢 **Online**" : "🔴 **Offline**";
        await editMessage(chatId, msgId, `🤖 **AI Support Status:** ${st}\n\nFor urgent queries, use 'Talk to Founder'.`, [[{text: "🗣️ Talk to Founder", callback_data: "talk_founder"}, {text: "🔙 Back", callback_data: "start"}]]);
    }
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
        
        // 1. SET QR CODE
        if (msg.photo && (msg.caption === "/setqr")) {
            ADMIN_QR_ID = msg.photo[msg.photo.length - 1].file_id;
            await sendMessage(chatId, "✅ **New QR Code Set!**"); return;
        }
        
        // 2. ADMIN REPLY SHORTCUTS
        if (text.startsWith("/reply ")) {
            let parts = text.split(" ");
            let uid = parts[1];
            let potentialOid = parts[2];
            let keyword = "";
            let targetOid = null;

            if (potentialOid && potentialOid.startsWith("ORD-")) {
                targetOid = potentialOid;
                keyword = parts.slice(3).join(" ").trim();
            } else {
                targetOid = userLatestOrder[uid] || "Unknown";
                keyword = parts.slice(2).join(" ").trim();
            }

            const SHORTCUTS = {
                "rec": "✅ **Order Received!**\nPayment verified. We will start shortly.",
                "start": "🚀 **Order Started!**\nWork is in progress.",
                "done": "🎉 **Order Completed!**\nThank you for your business!",
                "cancel": "❌ **Order Cancelled!**\nPayment not received or invalid details."
            };

            let statusUpdated = false;
            if (targetOid !== "Unknown") {
                if(keyword === "rec") { orderDB[targetOid] = "Received 🟢"; statusUpdated = true; }
                if(keyword === "start") { orderDB[targetOid] = "In Progress 🚀"; statusUpdated = true; }
                if(keyword === "done") { orderDB[targetOid] = "Completed ✅"; statusUpdated = true; }
                if(keyword === "cancel") { delete orderDB[targetOid]; statusUpdated = true; }
            }

            let customMsg = SHORTCUTS[keyword.toLowerCase()] || keyword;
            await sendMessage(uid, `📩 **Admin Update:**\n🆔 Order: \`${targetOid}\`\n\n${customMsg}`);
            
            if (keyword === "cancel") await sendMessage(chatId, `🚫 **Cancelled & Deleted:** ${targetOid}`);
            else await sendMessage(chatId, `✅ **Reply Sent!**`);
            return;
        }

        // 3. OTHER COMMANDS
        if (text === "/online") { adminStatus = "ONLINE"; await sendMessage(chatId, "🟢 **ONLINE**"); return; }
        if (text === "/offline") { adminStatus = "OFFLINE"; await sendMessage(chatId, "🔴 **OFFLINE**"); return; }
        if (text.startsWith("/broadcast ")) {
            let bMsg = text.replace("/broadcast ", "");
            for(let uid of allUsers) await sendMessage(uid, `📢 **ANNOUNCEMENT**\n\n${bMsg}`);
            await sendMessage(chatId, "✅ Broadcast Sent!"); return;
        }
        if (text.startsWith("/post ")) {
            await sendMessage(PUBLIC_CHANNEL_ID, text.replace("/post ", ""));
            await sendMessage(chatId, "✅ Posted!"); return;
        }
    }

    if (text === "/start") { delete userState[chatId]; await sendMainMenu(chatId); return; }

    // --- USER FLOW ---
    if (userState[chatId]) {
        const state = userState[chatId];

        // TRACKING
        if (state === "TRACKING") {
            let status = orderDB[text.trim()];
            if (status) await sendMessage(chatId, `🔎 **Order Status:**\n🆔 ID: \`${text.trim()}\`\n📊 Status: **${status}**`);
            else await sendMessage(chatId, `⚠️ **Order Not Found!**`);
            delete userState[chatId];
            return;
        }

        // STEP 1: QUANTITY -> ASK LINK
        if (state.startsWith("QTY_")) {
            let qty = parseInt(text);
            if (isNaN(qty) || qty < 10) { await sendMessage(chatId, "⚠️ Invalid Number (Min 10)"); return; }
            
            let d = state.replace("QTY_", "").split("|");
            let price = ((RATES[d[0]][d[1]] / 1000) * qty).toFixed(2);
            
            userState[chatId] = `WAITLINK_${d[0]}|${d[1]}|${qty}|${price}`;
            await sendMessage(chatId, `✅ **Quantity Accepted:** ${qty}\n💰 **Total Amount:** ₹${price}\n\n🔗 **Now Please Send your Profile/Post Link:**`);
        }
        
        // STEP 2: LINK -> CREATE ORDER -> NOTIFY ADMIN -> ASK QR
        else if (state.startsWith("WAITLINK_")) {
            if (!text.toLowerCase().includes("http") && !text.toLowerCase().includes("www")) {
                await sendMessage(chatId, "⚠️ **Invalid Link!**\nPlease send a valid URL starting with `http` or `www`.");
                return;
            }

            let d = state.replace("WAITLINK_", "").split("|");
            // d = [Platform, Service, Qty, Price]
            
            let oid = "ORD-" + Math.floor(10000 + Math.random() * 90000);
            orderDB[oid] = "Pending Payment 🟡";
            userLatestOrder[chatId] = oid;

            const userLink = `[${msg.from.first_name}](tg://user?id=${chatId})`;
            const username = msg.from.username ? `@${msg.from.username}` : "No Username";

            // 🔥 NOTIFY ADMIN IMMEDIATELY
            await sendMessage(ADMIN_ID, 
                `🚀 **NEW ORDER (Pending Payment)**\n` +
                `➖➖➖➖➖➖➖➖\n` +
                `🆔 **ID:** \`${oid}\`\n` +
                `👤 **User:** ${userLink} (\`${chatId}\`)\n` +
                `🔗 **Handle:** ${username}\n` +
                `📦 **Service:** ${d[1]} (${d[0]})\n` +
                `🔢 **Qty:** ${d[2]}\n` +
                `💰 **Price:** ₹${d[3]}\n` +
                `🔗 **Link:** ${text}\n` +
                `➖➖➖➖➖➖➖➖\n` +
                `⚠️ *Waiting for Screenshot...*`
            );

            // SAVE STATE
            userState[chatId] = `WAITSCR_${d[0]}|${d[1]}|${d[2]}|${d[3]}|${text}|${oid}`;

            const caption = `💰 **Order Created!** (ID: \`${oid}\`)\n` +
                            `➖➖➖➖➖➖➖➖\n` +
                            `📦 **Service:** ${d[1]}\n` +
                            `🔗 **Link:** ${text}\n` +
                            `💵 **Amount to Pay:** ₹${d[3]}\n` +
                            `➖➖➖➖➖➖➖➖\n\n` +
                            `📸 **Scan QR & Send Screenshot**\n` +
                            `Please send payment screenshot to confirm.`;

            if (ADMIN_QR_ID) await sendPhoto(chatId, ADMIN_QR_ID, caption);
            else await sendMessage(chatId, "⚠️ **System Message:** Please pay to Admin and send screenshot.");
        }

        // STEP 3: SCREENSHOT -> SEND PROOF TO ADMIN
        else if (state.startsWith("WAITSCR_")) {
            if (!msg.photo) {
                await sendMessage(chatId, "⚠️ **Photo Required!**\nPlease send the payment **Screenshot**.");
                return;
            }

            let d = state.replace("WAITSCR_", "").split("|");
            // d = [Platform, Service, Qty, Price, UserLink, OID]
            let oid = d[5];

            const userLink = `[${msg.from.first_name}](tg://user?id=${chatId})`;
            let photoId = msg.photo[msg.photo.length - 1].file_id;
            let cap = msg.caption ? msg.caption : "Paid";

            await sendPhoto(ADMIN_ID, photoId, 
                `📸 **PAYMENT PROOF RECEIVED**\n` +
                `➖➖➖➖➖➖➖➖\n` +
                `🆔 **ID:** \`${oid}\`\n` +
                `👤 **User:** ${userLink}\n` +
                `💰 **Amount:** ₹${d[3]}\n` +
                `📝 **Note:** ${cap}\n` +
                `➖➖➖➖➖➖➖➖\n` +
                `✅ Verify & Start Order.`
            );

            await sendMessage(chatId, `✅ **Payment Received!**\n🆔 ID: \`${oid}\`\nAdmin will verify and start your order shortly.`);
            delete userState[chatId];
        }

        // PROJECT REQUEST
        else if (state.startsWith("PROJ_")) {
            let type = state.replace("PROJ_", "");
            let pid = "PRJ-" + Math.floor(1000 + Math.random() * 9000);
            const userLink = `[${msg.from.first_name}](tg://user?id=${chatId})`;
            const username = msg.from.username ? `@${msg.from.username}` : "No Username";
            
            await sendMessage(ADMIN_ID, `🌐 **PROJECT REQUEST**\n🆔 **ID:** \`${pid}\`\n👤 **User:** ${userLink}\n🔗 **Handle:** ${username}\n🛠 **Type:** ${type}\n📝 **Msg:** ${text}`);
            await sendMessage(chatId, `✅ **Request Saved!**\n🆔 Project ID: \`${pid}\`\nTeam will contact you.`);
            delete userState[chatId];
        }
    }
}

// ================= 5. HELPERS =================
async function sendMessage(chatId, text, kb) {
    try { await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text: text, parse_mode: "Markdown", reply_markup: kb ? {inline_keyboard: kb} : undefined, disable_web_page_preview: true }); } catch(e){ console.log("SendMsg Error"); }
}
async function sendPhoto(chatId, photo, caption) {
    try { await axios.post(`${TELEGRAM_API}/sendPhoto`, { chat_id: chatId, photo: photo, caption: caption, parse_mode: "Markdown" }); } catch(e){ console.log("SendPhoto Error"); }
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
