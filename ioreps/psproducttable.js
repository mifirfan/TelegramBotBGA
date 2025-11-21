// =============================================
// psproducttable.js — FINAL VERSION
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

async function renderPSProduct(rows) {

    //----------------------------------------------------
    // 1. HEADER TOP — FIX 19 KOLOM
    //----------------------------------------------------
    const headerTop = [
        "Cluster",
        "IH Reguler", "", "",
        "EZnet", "", "",
        "Dragon", "", "",
        "Tsel One", "", "",
        "Tsel One & Dragon", "", "",
        "All", "", ""   
    ];



    //----------------------------------------------------
    // 2. HEADER BOTTOM — 19 KOLOM (SAMA)
    //----------------------------------------------------
    const headerBottom = [
        " ",
        "Mtd","MoM","Cont",
        "Mtd","MoM","Cont",
        "Mtd","MoM","Cont",
        "Mtd","MoM","Cont",
        "Mtd","MoM","Cont",
        "Mtd","MoM","Ytd"
    ];



    //----------------------------------------------------
    // 3. MERGED COLUMNS (PERFECT ALIGNMENT)
    //----------------------------------------------------
    const mergedColumns = {
        "IH Reguler": [1, 3],
        "EZnet": [4, 6],
        "Dragon": [7, 9],
        "Tsel One": [10, 12],
        "Tsel One & Dragon": [13, 15],
        "All": [16, 18]
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

                IHReguler_MTD: formatNumber(r.IHReguler_MTD),
                IHReguler_MoM: formatPercent(r.IHReguler_MoM),
                IHReguler_Cont: formatPercent(r.IHReguler_Cont),

                EZnet_MTD: formatNumber(r.EZnet_MTD),
                EZnet_MoM: formatPercent(r.EZnet_MoM),
                EZnet_Cont: formatPercent(r.EZnet_Cont),

                Dragon_MTD: formatNumber(r.Dragon_MTD),
                Dragon_MoM: formatPercent(r.Dragon_MoM),
                Dragon_Cont: formatPercent(r.Dragon_Cont),

                TselOne_MTD: formatNumber(r.TselOne_MTD),
                TselOne_MoM: formatPercent(r.TselOne_MoM),
                TselOne_Cont: formatPercent(r.TselOne_Cont),

                TselDragon_MTD: formatNumber(r.TselDragon_MTD),
                TselDragon_MoM: formatPercent(r.TselDragon_MoM),
                TselDragon_Cont: formatPercent(r.TselDragon_Cont),

                ALL_MTD: formatNumber(r.ALL_MTD),
                ALL_MoM: formatPercent(r.ALL_MoM),
                ALL_YTD: formatPercent(r.ALL_YTD),
            });
        }
    });

    //----------------------------------------------------
    // 5. Build matrix 2D
    //----------------------------------------------------
    const matrix = allRows.map(r => {
        if (r.separator) return new Array(19).fill("");

        return [
            r.label,
            r.IHReguler_MTD, r.IHReguler_MoM, r.IHReguler_Cont,
            r.EZnet_MTD, r.EZnet_MoM, r.EZnet_Cont,
            r.Dragon_MTD, r.Dragon_MoM, r.Dragon_Cont,
            r.TselOne_MTD, r.TselOne_MoM, r.TselOne_Cont,
            r.TselDragon_MTD, r.TselDragon_MoM, r.TselDragon_Cont,
            r.ALL_MTD, r.ALL_MoM, r.ALL_YTD
        ];
    });

    //----------------------------------------------------
    // 6. AUTO WIDTH
    //----------------------------------------------------
    const font = "20px Arial";
    const padding = 19;

    const tmp = createCanvas(10, 10);
    const ctx2 = tmp.getContext("2d");
    ctx2.font = font;

    const colCount = 19;

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

module.exports = { renderPSProduct };
