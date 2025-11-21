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
1️⃣ /hourly — RSM Hourly — (Coming Soon)
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
                [{ text: "📅 IOREPS Custom", callback_data: "ioreps_customize" }],
                [{ text: "⚡ IOREPS Summary", callback_data: "ioreps_recent" }],
                [{ text: "📅 IO,RE,PS Channel Custom", callback_data: "iorepschannel_customize" }],
                [{ text: "⚡ IO,RE,PS Channel Summary", callback_data: "iorepschannel_recent" }],
                [{ text: "⚡ PS Product" , callback_data: "psproduct" }],
                [{ text: "⚡ PS Product EZNet by channel (coming soon)", callback_data: "psproduct_eznet" }],
                [{ text: "⚡ PS Product Tsel One by channel (coming soon)", callback_data: "psproduct_tselone" }]
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
    // IOREPS CHANNEL; CUSTOMIZE — pilih tahun
    // -----------------------------
    if (data === "iorepschannel_customize") {
        const [years] = await pool.query(`
            SELECT DISTINCT YEAR(io_date) AS tahun
            FROM fmc_mirror.ih_io_summary
            ORDER BY tahun DESC
        `);

        return bot.sendMessage(chatId, "📅 Pilih Tahun:", {
            reply_markup: {
                inline_keyboard: years.map(y => [{
                    text: y.tahun.toString(),
                    callback_data: `iorepschannel_year_${y.tahun}`
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
    // IOREPS CHANNEL → pilih bulan
    // -----------------------------
    if (data.startsWith("iorepschannel_year_")) {
        const year = data.split("_")[2];

        const [months] = await pool.query(`
            SELECT DISTINCT LPAD(MONTH(io_date),2,'0') AS bulan
            FROM fmc_mirror.ih_io_summary
            WHERE YEAR(io_date)=?
            ORDER BY bulan
        `, [year]);

        return bot.sendMessage(chatId, `📆 Pilih Bulan (${year}):`, {
            reply_markup: {
                inline_keyboard: months.map(m => [{
                    text: m.bulan,
                    callback_data: `iorepschannel_month_${year}_${m.bulan}`
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
    // IOREPS CHANNEL → pilih hari
    // -----------------------------
    if (data.startsWith("iorepschannel_month_")) {
        const [_, __, year, month] = data.split("_");

        const [days] = await pool.query(`
            SELECT DISTINCT LPAD(DAY(io_date),2,'0') AS hari
            FROM fmc_mirror.ih_io_summary
            WHERE YEAR(io_date)=? AND MONTH(io_date)=?
            ORDER BY hari
        `, [year, month]);

        return bot.sendMessage(chatId, `📅 Pilih Tanggal (${year}-${month}):`, {
            reply_markup: {
                inline_keyboard: days.map(d => [{
                    text: d.hari,
                    callback_data: `iorepschannel_day_${year}_${month}_${d.hari}`
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

    // -----------------------------
    // IOREPS CHANNEL CUSTOMIZE — generate table
    // -----------------------------
    if (data.startsWith("iorepschannel_day_")) {
        const [_, __, year, month, day] = data.split("_");
        const selectedDate = `${year}-${month}-${day}`;

        bot.sendMessage(chatId, `⏳ Membuat IO,RE,PS Channel untuk *${selectedDate}* ...`, {
            parse_mode: "Markdown"
        });
        
        // ---------------- IO CHANNEL ----------------
        try {
            const { getIOChannelData } = require("./ioreps/iochannelquery");
            const { renderIOChannel } = require("./ioreps/iochanneltable");


            const ioChannelRows = await getIOChannelData(selectedDate);
            const img = await renderIOChannel(ioChannelRows);
            await bot.sendPhoto(chatId, img, {
            caption: `📌 IO CHANNEL (${selectedDate})`
        });
        } catch (err) {
            bot.sendMessage(chatId, "❌ Gagal membuat IO Channel.");
        }

        // ---------------- RE CHANNEL ----------------
        try {
            const { getREChannelData } = require("./ioreps/rechannelquery");
            const { renderREChannel } = require("./ioreps/rechanneltable");


            const reChannelRows = await getREChannelData(selectedDate);
            const img2 = await renderREChannel(reChannelRows);
            await bot.sendPhoto(chatId, img2, {
            caption: `📌 RE CHANNEL (${selectedDate})`
        });
        } catch (err) {
            bot.sendMessage(chatId, "❌ Gagal membuat RE Channel.");
        }
        
        // ---------------- PS CHANNEL ----------------
        try {
            const { getPSChannelData } = require("./ioreps/pschannelquery");
            const { renderPSChannel } = require("./ioreps/pschanneltable");


            const psChannelRows = await getPSChannelData(selectedDate);
            const img3 = await renderPSChannel(psChannelRows);
            await bot.sendPhoto(chatId, img3, {
            caption: `📌 PS CHANNEL (${selectedDate})`
        });
        } catch (err) {
            bot.sendMessage(chatId, "❌ Gagal membuat PS Channel.");
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

        // ---------------- IOREPS ----------------
        const img = await renderIOREPS(latestDate);
        await bot.sendPhoto(chatId, img, {
            caption: `📌 IOREPS MoM RECENT (${latestDate})`
        });

    } catch (err) {
        console.error("RECENT ERROR:", err);
        bot.sendMessage(chatId, "❌ Gagal membuat IOREPS Recently.");
    }
}

// =======================================================
// IO,RE,PS CHANNEL SUMMARY — tanggal terbaru otomatis
// =======================================================
if (data === "iorepschannel_recent") {
    bot.sendMessage(chatId, "⚡ Mengambil data IO,RE,PS Channel terbaru...");

    try {
        const [latest] = await pool.query(`
            SELECT DATE(MAX(io_date)) AS latest
            FROM fmc_mirror.ih_io_summary
        `);

        const latestDate = formatDate(latest[0].latest);

        bot.sendMessage(chatId, `⏳ Membuat IO Channel MoM terbaru (*${latestDate}*) ...`, {
            parse_mode: "Markdown"
        });

        // ---------------- IO Channel ----------------
       const { getIOChannelData } = require("./ioreps/iochannelquery");
       const { renderIOChannel } = require("./ioreps/iochanneltable");


            const ioChannelRowss = await getIOChannelData(latestDate);
            const img = await renderIOChannel(ioChannelRowss);
            await bot.sendPhoto(chatId, img, {
            caption: `📌 IO CHANNEL (${latestDate})`
        });

    } catch (err) {
        console.error("RECENT ERROR:", err);
        bot.sendMessage(chatId, "❌ Gagal membuat IO Channel Summary");
    }

    
    try {
        const [latest] = await pool.query(`
            SELECT DATE(MAX(io_date)) AS latest
            FROM fmc_mirror.ih_io_summary
        `);

        const latestDate = formatDate(latest[0].latest);

        bot.sendMessage(chatId, `⏳ Membuat RE Channel MoM terbaru (*${latestDate}*) ...`, {
            parse_mode: "Markdown"
        });

        // ---------------- RE Channel ----------------
       const { getREChannelData } = require("./ioreps/rechannelquery");
       const { renderREChannel } = require("./ioreps/rechanneltable");


            const reChannelRowss = await getREChannelData(latestDate);
            const img2 = await renderREChannel(reChannelRowss);
            await bot.sendPhoto(chatId, img2, {
            caption: `📌 RE CHANNEL (${latestDate})`
        });

    } catch (err) {
        console.error("RECENT ERROR:", err);
        bot.sendMessage(chatId, "❌ Gagal membuat RE Channel Summary");
    }

    try {
        const [latest] = await pool.query(`
            SELECT DATE(MAX(io_date)) AS latest
            FROM fmc_mirror.ih_io_summary
        `);

        const latestDate = formatDate(latest[0].latest);

        bot.sendMessage(chatId, `⏳ Membuat PS Channel MoM terbaru (*${latestDate}*) ...`, {
            parse_mode: "Markdown"
        });

        // ---------------- PS Channel ----------------
       const { getPSChannelData } = require("./ioreps/pschannelquery");
       const { renderPSChannel } = require("./ioreps/pschanneltable");


            const psChannelRowss = await getPSChannelData(latestDate);
            const img3 = await renderPSChannel(psChannelRowss);
            await bot.sendPhoto(chatId, img3, {
            caption: `📌 RE CHANNEL (${latestDate})`
        });

    } catch (err) {
        console.error("RECENT ERROR:", err);
        bot.sendMessage(chatId, "❌ Gagal membuat RE Channel Summary");
    }
}

// =======================================================
// PS Product SUMMARY — tanggal terbaru otomatis
// =======================================================
if (data === "psproduct") {
    bot.sendMessage(chatId, "⚡ Mengambil data PS Product Summary...");

    try {
        const [latest] = await pool.query(`
            SELECT DATE(MAX(ps_date)) AS latest
            FROM fmc_mirror.ih_ps_summary
        `);

        const latestDate = formatDate(latest[0].latest);

        bot.sendMessage(chatId, `⏳ Membuat PS Product Summary (*${latestDate}*) ...`, {
            parse_mode: "Markdown"
        });

        // ---------------- PSProduct ----------------
       const { getPSProductData } = require("./ioreps/psproductquery");
       const { renderPSProduct } = require("./ioreps/psproducttable");


            const psproductRowss = await getPSProductData(latestDate);
            const img = await renderPSProduct(psproductRowss);
            await bot.sendPhoto(chatId, img, {
            caption: `📌 PS Product (${latestDate})`
        });

    } catch (err) {
        console.error("RECENT ERROR:", err);
        bot.sendMessage(chatId, "❌ Gagal membuat PS Product Summary");
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
