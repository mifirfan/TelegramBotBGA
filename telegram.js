// ===============================
// TELEGRAM BOT CONTROLLER — PREMIUM UI
// ===============================

const TelegramBot = require("node-telegram-bot-api");
const pool = require("./database");
const { createRsmHourlyImage } = require("./hourly/rsmhourly");
const { renderIOREPS } = require("./ioreps/ioreps");

// ---- TOKEN -----
const BOT_TOKEN = "8236249994:AAEfKIKWudepq6-knVqp99C2uALOr66Y6gA"; // Ganti!
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 Bot Telegram berjalan…");


// ===================================================
//  FORMAT FANCY HEADER (Style C)
// ===================================================
function fancyHeader(title) {
    return (
`╔════════════════════════════╗
║  ${title}  
╚════════════════════════════╝`
    );
}

// ===================================================
//  /start HIGH-END MENU
// ===================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const menu = `
${fancyHeader("📊 PILIH LAPORAN")}
Pilih laporan yang ingin ditampilkan ⤵️
    `;

    bot.sendMessage(chatId, menu, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: "⚡ RSM Hourly", callback_data: "menu_hourly" }],
                [{ text: "📊 IOREPS MoM", callback_data: "menu_ioreps" }],
                [{ text: "📈 Marketshare", callback_data: "menu_marketshare" }],
                [{ text: "📚 Retensi CAPS", callback_data: "menu_retensicaps" }],
            ]
        }
    });
});


// ===================================================
//  GRID BUILDER (AUTO WIDTH)
// ===================================================
function buildGrid(items, prefix) {
    const grid = [];
    let row = [];

    items.forEach((item, idx) => {
        row.push({
            text: item.label,
            callback_data: `${prefix}_${item.value}`
        });

        // auto 3–4 kolom tergantung panjang text
        if (row.length >= (item.label.length <= 2 ? 4 : 3)) {
            grid.push(row);
            row = [];
        }
    });

    if (row.length > 0) grid.push(row);
    return grid;
}


// ===================================================
//  FOLDER: IOREPS REPORT
// ===================================================
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    // -------------------------
    // MENU: IOREPS → pilih tahun
    // -------------------------
    if (data === "menu_ioreps") {
        bot.sendMessage(chatId, fancyHeader("📅 PILIH TAHUN"), {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "<< Kembali", callback_data: "back_main" }]
                ]
            }
        });

        const [years] = await pool.query(`
            SELECT DISTINCT YEAR(tgl) AS y 
            FROM fmc_mirror.ih_ioreps_dd 
            ORDER BY y DESC
        `);

        const grid = buildGrid(
            years.map(y => ({ label: String(y.y), value: y.y })),
            "ioreps_year"
        );

        bot.sendMessage(chatId, "Silakan pilih tahun:", {
            reply_markup: { inline_keyboard: [...grid, [{ text: "⬅️ Kembali", callback_data: "back_main" }]] }
        });
    }

    // -------------------------
    // KEMBALI KE MENU UTAMA
    // -------------------------
    if (data === "back_main") {
        bot.sendMessage(chatId, "🔙 Kembali ke menu utama…");
        bot.emit("text", { chat: { id: chatId }, text: "/start" });
        return;
    }

    // -------------------------
    // PILIH BULAN
    // -------------------------
    if (data.startsWith("ioreps_year_")) {
        const year = data.split("_")[2];

        const [months] = await pool.query(`
            SELECT DISTINCT LPAD(MONTH(tgl), 2, '0') AS m
            FROM fmc_mirror.ih_ioreps_dd 
            WHERE YEAR(tgl)=?
            ORDER BY m
        `, [year]);

        const grid = buildGrid(
            months.map(m => ({ label: m.m, value: `${year}_${m.m}` })),
            "ioreps_month"
        );

        bot.sendMessage(chatId, fancyHeader(`📆 ${year} — PILIH BULAN`), {
            reply_markup: { inline_keyboard: [...grid, [{ text: "⬅️ Kembali", callback_data: "menu_ioreps" }]] }
        });
    }

    // -------------------------
    // PILIH TANGGAL
    // -------------------------
    if (data.startsWith("ioreps_month_")) {
        const [_, __, year, month] = data.split("_");

        const [days] = await pool.query(`
            SELECT DISTINCT LPAD(DAY(tgl), 2, '0') AS d
            FROM fmc_mirror.ih_ioreps_dd
            WHERE YEAR(tgl)=? AND MONTH(tgl)=?
            ORDER BY d
        `, [year, month]);

        const grid = buildGrid(
            days.map(d => ({ label: d.d, value: `${year}_${month}_${d.d}` })),
            "ioreps_day"
        );

        bot.sendMessage(chatId, fancyHeader(`📅 ${year}-${month} — PILIH TANGGAL`), {
            reply_markup: { inline_keyboard: [...grid, [{ text: "⬅️ Kembali", callback_data: `ioreps_year_${year}` }]] }
        });
    }

    // -------------------------
    // FINAL — GENERATE REPORT
    // -------------------------
    if (data.startsWith("ioreps_day_")) {
        const [_, __, year, month, day] = data.split("_");
        const selectedDate = `${year}-${month}-${day}`;

        bot.sendMessage(chatId, `⏳ Mengambil laporan IOREPS untuk *${selectedDate}* …`, {
            parse_mode: "Markdown"
        });

        try {
            const img = await renderIOREPS(selectedDate);

            await bot.sendPhoto(chatId, img, {
                caption: `📊 IOREPS — ${selectedDate}`
            });

            // NAVIGASI SETELAH LAPORAN
            bot.sendMessage(chatId, "Apa selanjutnya?", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔁 Pilih tanggal lain", callback_data: "menu_ioreps" }],
                        [{ text: "📂 Pilih laporan lain", callback_data: "back_main" }],
                        [{ text: "🏠 Menu Utama", callback_data: "back_main" }],
                    ]
                }
            });

        } catch (err) {
            console.error(err);
            bot.sendMessage(chatId, "❌ Gagal membuat laporan IOREPS.");
        }
    }

    // -----------------------------------------------------
    // FITUR LAIN (Hourly / Marketshare / Retensi)
    // -----------------------------------------------------

    if (data === "menu_hourly") {
        bot.sendMessage(chatId, "⏳ Membuat laporan hourly...");
        try {
            const img = await createRsmHourlyImage();
            bot.sendPhoto(chatId, img, { caption: "⚡ Hourly Report" });
        } catch (err) {
            bot.sendMessage(chatId, "❌ Gagal membuat laporan hourly.");
        }
    }

    if (data === "menu_marketshare") {
        bot.sendMessage(chatId, "📈 Fitur Marketshare sedang dibangun.");
    }

    if (data === "menu_retensicaps") {
        bot.sendMessage(chatId, "📚 Fitur Retensi & CAPS sedang dibangun.");
    }
});
