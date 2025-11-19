// ===============================
// TELEGRAM BOT MAIN CONTROLLER
// ===============================

const TelegramBot = require("node-telegram-bot-api");
const pool = require("./database");
const { createRsmHourlyImage } = require("./hourly/rsmhourly");
const { renderIOREPS } = require("./ioreps/ioreps");

// ---- TOKEN -----
const BOT_TOKEN = "8236249994:AAEfKIKWudepq6-knVqp99C2uALOr66Y6gA";
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 Bot Telegram berjalan…");
console.log("🤖 Bot aktif — ketik /start");

// ==========================================
// FORMAT TANGGAL → YYYY-MM-DD
// ==========================================
function formatDate(d) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// ===============================
// MENU UTAMA /start
// ===============================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const menu = `
📊 *Laporan*
1️⃣ /hourly — RSM Hourly  
2️⃣ /ioreps — IOREPS MoM  
3️⃣ /marketshare — (Coming Soon)  
4️⃣ /retensicaps — (Coming Soon)
    `;

    bot.sendMessage(chatId, menu, { parse_mode: "Markdown" });
});

// ===============================
// HOURLY
// ===============================
bot.onText(/\/hourly/, async (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, "⏳ Mengambil Hourly Report...");

    try {
        const imgPath = await createRsmHourlyImage();
        bot.sendPhoto(chatId, imgPath, { caption: "📌 Hourly Report" });
    } catch (err) {
        bot.sendMessage(chatId, "❌ Gagal membuat laporan hourly.");
    }
});

// =======================================================
// IOREPS MENU (Customize / Recently)
// =======================================================
bot.onText(/\/ioreps/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, "📊 Pilih mode IOREPS:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📅 IOREPS Customize", callback_data: "ioreps_customize" }],
                [{ text: "⚡ IOREPS Recently", callback_data: "ioreps_recent" }]
            ]
        }
    });
});

// =======================================================
// CALLBACK HANDLER
// =======================================================
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    // -----------------------------
    // IOREPS CUSTOMIZE — pilih tahun
    // -----------------------------
    if (data === "ioreps_customize") {
        const [years] = await pool.query(`
            SELECT DISTINCT YEAR(tgl) AS tahun
            FROM fmc_mirror.ih_ioreps_dd
            ORDER BY tahun DESC
        `);

        return bot.sendMessage(chatId, "📅 Pilih Tahun:", {
            reply_markup: {
                inline_keyboard: years.map(y => [{
                    text: y.tahun.toString(),
                    callback_data: `ioreps_year_${y.tahun}`
                }])
            }
        });
    }

    // -----------------------------
    // IOREPS → pilih bulan
    // -----------------------------
    if (data.startsWith("ioreps_year_")) {
        const year = data.split("_")[2];

        const [months] = await pool.query(`
            SELECT DISTINCT LPAD(MONTH(tgl),2,'0') AS bulan
            FROM fmc_mirror.ih_ioreps_dd
            WHERE YEAR(tgl)=?
            ORDER BY bulan
        `, [year]);

        return bot.sendMessage(chatId, `📆 Pilih Bulan (${year}):`, {
            reply_markup: {
                inline_keyboard: months.map(m => [{
                    text: m.bulan,
                    callback_data: `ioreps_month_${year}_${m.bulan}`
                }])
            }
        });
    }

    // -----------------------------
    // IOREPS → pilih hari
    // -----------------------------
    if (data.startsWith("ioreps_month_")) {
        const [_, __, year, month] = data.split("_");

        const [days] = await pool.query(`
            SELECT DISTINCT LPAD(DAY(tgl),2,'0') AS hari
            FROM fmc_mirror.ih_ioreps_dd
            WHERE YEAR(tgl)=? AND MONTH(tgl)=?
            ORDER BY hari
        `, [year, month]);

        return bot.sendMessage(chatId, `📅 Pilih Tanggal (${year}-${month}):`, {
            reply_markup: {
                inline_keyboard: days.map(d => [{
                    text: d.hari,
                    callback_data: `ioreps_day_${year}_${month}_${d.hari}`
                }])
            }
        });
    }

    // -----------------------------
    // IOREPS CUSTOMIZE — generate table
    // -----------------------------
    if (data.startsWith("ioreps_day_")) {
        const [_, __, year, month, day] = data.split("_");
        const selectedDate = `${year}-${month}-${day}`;

        bot.sendMessage(chatId, `⏳ Membuat IOREPS MoM untuk *${selectedDate}* ...`, {
            parse_mode: "Markdown"
        });

        try {
            const img = await renderIOREPS(selectedDate);
            bot.sendPhoto(chatId, img, { caption: `📌 IOREPS MoM (${selectedDate})` });
        } catch (err) {
            bot.sendMessage(chatId, "❌ Gagal membuat IOREPS.");
        }
    }

    // =======================================================
    // IOREPS RECENTLY — tanggal terbaru otomatis
    // =======================================================
    if (data === "ioreps_recent") {
        bot.sendMessage(chatId, "⚡ Mengambil data IOREPS terbaru...");

        try {
            const [latest] = await pool.query(`
                SELECT DATE(MAX(tgl)) AS latest
                FROM fmc_mirror.ih_ioreps_dd
            `);

            const latestDate = formatDate(latest[0].latest);

            bot.sendMessage(chatId, `⏳ Membuat IOREPS MoM terbaru (*${latestDate}*) ...`, {
                parse_mode: "Markdown"
            });

            const img = await renderIOREPS(latestDate);
            bot.sendPhoto(chatId, img, {
                caption: `📌 IOREPS MoM RECENT (${latestDate})`
            });

        } catch (err) {
            bot.sendMessage(chatId, "❌ Gagal membuat IOREPS Recently.");
        }
    }
});

// -------------------------------
bot.onText(/\/marketshare/, (msg) => {
    bot.sendMessage(msg.chat.id, "📌 Fitur Marketshare sedang dibuat.");
});
bot.onText(/\/retensicaps/, (msg) => {
    bot.sendMessage(msg.chat.id, "📌 Fitur Retensi/CAPS sedang dibuat.");
});
