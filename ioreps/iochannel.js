const { createCanvas } = require("canvas");

async function generateIOREPSImage(rows) {

    const header = [
        "Cluster", "IO", "MoM IO", "RE", "MoM RE",
        "PS", "MoM PS", "%RE→IO", "%PS→IO", "%PS→RE"
    ];

    const font = "20px Arial";
    const rowHeight = 45;
    const headerHeight = 55;
    const padding = 20;

    const tempCanvas = createCanvas(10, 10);
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.font = font;

    // hitung lebar kolom otomatis
    const colWidths = header.map((col, i) => {
        const maxWidth = Math.max(
            tempCtx.measureText(col).width,
            ...rows.map(r => tempCtx.measureText(String(Object.values(r)[i] || "")).width)
        );
        return maxWidth + padding * 2;
    });

    const width = colWidths.reduce((a, b) => a + b, 0);
    const height = headerHeight + rows.length * rowHeight;

    const canvas = createCanvas(width + 2, height + 2);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    ctx.font = font;

    // Header
    ctx.fillStyle = "#E6E6E6";
    ctx.fillRect(0, 0, width, headerHeight);

    ctx.fillStyle = "#000";
    ctx.font = "bold 20px Arial";

    let x = 0;
    header.forEach((text, i) => {
        ctx.strokeRect(x, 0, colWidths[i], headerHeight);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + colWidths[i] / 2, headerHeight / 2);
        x += colWidths[i];
    });

    ctx.font = font;

    let y = headerHeight;

    rows.forEach(row => {
        x = 0;

        Object.values(row).forEach((val, i) => {
            ctx.strokeRect(x, y, colWidths[i], rowHeight);

            // warna MoM
            if ([2, 4, 6].includes(i)) {
                let num = parseFloat(val);
                ctx.fillStyle = num >= 0 ? "#008000" : "#CC0000";
            } else {
                ctx.fillStyle = "#000";
            }

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(val ?? ""), x + colWidths[i] / 2, y + rowHeight / 2);

            x += colWidths[i];
        });

        y += rowHeight;
    });

    return canvas.toBuffer("image/png");
}

module.exports = { generateIOREPSImage };
