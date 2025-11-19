// =============================================
// iorepstable.js — FINAL VERSION
// =============================================

const { createCanvas } = require("canvas");

// Format ribuan
function formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return "0";
    return Number(val).toLocaleString("id-ID");
}

// Format persen dengan satu decimal
function formatPercent(val) {
    if (val === null || val === undefined || isNaN(val)) return "0%";
    return Number(val).toFixed(1) + "%";
}

async function renderIOREPS(rows) {

    //----------------------------------------------------
    // 1. HEADER TOP — FIX 16 KOLOM
    //----------------------------------------------------
    const headerTop = [
        "Cluster",
        "IO", "", "",
        "RE", "", "",
        "PS", "", "",
        "%RE to IO", "",
        "%PS to IO", "",
        "%PS to RE", ""
    ];

    //----------------------------------------------------
    // 2. HEADER BOTTOM — 16 KOLOM (SAMA)
    //----------------------------------------------------
    const headerBottom = [
        "   ",
        "Act","Daily","MoM",
        "Act","Daily","MoM",
        "Act","Daily","MoM",
        "Act","ppt",
        "Act","ppt",
        "Act","ppt"
    ];

    //----------------------------------------------------
    // 3. MERGED COLUMNS (PERFECT ALIGNMENT)
    //----------------------------------------------------
    const mergedColumns = {
        "IO": [1, 3],
        "RE": [4, 6],
        "PS": [7, 9],
        "%RE to IO": [10, 11],
        "%PS to IO": [12, 13],
        "%PS to RE": [14, 15]
    };

    //----------------------------------------------------
    // 4. Convert rows → matrix
    //----------------------------------------------------
    const allRows = [];

    rows.forEach(r => {
        if (r.separator) {
            allRows.push({ separator: true });
        } else {
            allRows.push({
                label: r.label,

                IO_ACT: formatNumber(r.IO_ACT),
                IO_DAILY: formatNumber(r.IO_DAILY),
                IO_MoM: formatPercent(r.IO_MoM),

                RE_ACT: formatNumber(r.RE_ACT),
                RE_DAILY: formatNumber(r.RE_DAILY),
                RE_MoM: formatPercent(r.RE_MoM),

                PS_ACT: formatNumber(r.PS_ACT),
                PS_DAILY: formatNumber(r.PS_DAILY),
                PS_MoM: formatPercent(r.PS_MoM),

                RE_to_IO_ACT: formatPercent(r.RE_to_IO_ACT),
                RE_to_IO_PPT: formatPercent(r.RE_to_IO_PPT),

                PS_to_IO_ACT: formatPercent(r.PS_to_IO_ACT),
                PS_to_IO_PPT: formatPercent(r.PS_to_IO_PPT),

                PS_to_RE_ACT: formatPercent(r.PS_to_RE_ACT),
                PS_to_RE_PPT: formatPercent(r.PS_to_RE_PPT)
            });
        }
    });

    //----------------------------------------------------
    // 5. Build matrix 2D
    //----------------------------------------------------
    const matrix = allRows.map(r => {
        if (r.separator) return new Array(16).fill("");

        return [
            r.label,
            r.IO_ACT, r.IO_DAILY, r.IO_MoM,
            r.RE_ACT, r.RE_DAILY, r.RE_MoM,
            r.PS_ACT, r.PS_DAILY, r.PS_MoM,
            r.RE_to_IO_ACT, r.RE_to_IO_PPT,
            r.PS_to_IO_ACT, r.PS_to_IO_PPT,
            r.PS_to_RE_ACT, r.PS_to_RE_PPT
        ];
    });

    //----------------------------------------------------
    // 6. AUTO WIDTH
    //----------------------------------------------------
    const font = "20px Arial";
    const padding = 16;

    const tmp = createCanvas(10, 10);
    const ctx2 = tmp.getContext("2d");
    ctx2.font = font;

    const colCount = 16;

    const colWidths = new Array(colCount).fill(0).map((_, i) => {
        const wTop = ctx2.measureText(headerTop[i] || "").width;
        const wBottom = ctx2.measureText(headerBottom[i] || "").width;
        const wData = Math.max(...matrix.map(r => ctx2.measureText(String(r[i])).width));
        return Math.max(wTop, wBottom, wData) + padding * 2;
    });

    //----------------------------------------------------
    // 7. CANVAS SIZE
    //----------------------------------------------------
    const rowHeight = 48;
    const headerTopHeight = 46;
    const headerBottomHeight = 40;

    const W = colWidths.reduce((a, b) => a + b, 0);
    const H = headerTopHeight + headerBottomHeight + matrix.length * rowHeight;

    //----------------------------------------------------
    // 8. RENDER
    //----------------------------------------------------
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#000";

    //----------------------------------------------------
    // HEADER TOP
    //----------------------------------------------------
    let x = 0;
    let y = 0;

    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(0, 0, W, headerTopHeight);
    ctx.fillStyle = "#000";

    let col = 0;
    while (col < colCount) {
        const label = headerTop[col];
        const merge = mergedColumns[label];

        if (merge) {
            const [start, end] = merge;
            const width = colWidths.slice(start, end + 1).reduce((a, b) => a + b, 0);
            const offset = colWidths.slice(0, start).reduce((a, b) => a + b, 0);

            ctx.strokeRect(offset, y, width, headerTopHeight);
            ctx.fillText(label, offset + width / 2, y + headerTopHeight / 2);

            col = end + 1;
        } else {
            ctx.strokeRect(x, y, colWidths[col], headerTopHeight);
            ctx.fillText(label || "", x + colWidths[col] / 2, y + headerTopHeight / 2);

            x += colWidths[col];
            col++;
        }
    }

    //----------------------------------------------------
    // HEADER BOTTOM
    //----------------------------------------------------
    y += headerTopHeight;
    x = 0;

    ctx.fillStyle = "#e6e6e6";
    ctx.fillRect(0, y, W, headerBottomHeight);
    ctx.fillStyle = "#000";

    for (let i = 0; i < colCount; i++) {
        ctx.strokeRect(x, y, colWidths[i], headerBottomHeight);
        ctx.fillText(headerBottom[i] || "", x + colWidths[i] / 2, y + headerBottomHeight / 2);
        x += colWidths[i];
    }

    //----------------------------------------------------
    // DATA ROWS
    //----------------------------------------------------
    y += headerBottomHeight;

    matrix.forEach(row => {
        x = 0;

        if (row[0] === "") {
            ctx.fillStyle = "#f5f5f5";
            ctx.fillRect(x, y, W, rowHeight);
            ctx.fillStyle = "#000";
            ctx.strokeRect(x, y, W, rowHeight);
            y += rowHeight;
            return;
        }

        row.forEach((cell, c) => {
            const text = String(cell);
            const isNeg = text.includes("-");

            ctx.strokeRect(x, y, colWidths[c], rowHeight);
            ctx.fillStyle = isNeg ? "red" : "black";
            ctx.fillText(text, x + colWidths[c] / 2, y + rowHeight / 2);

            x += colWidths[c];
        });

        y += rowHeight;
    });

    return canvas.toBuffer("image/png");
}

module.exports = { renderIOREPS };
