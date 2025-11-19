// iorepstable.js (FINAL)
// Renders canvas with top/bottom headers, thousand format, daily integer, MoM & ppt as % with 1 decimal,
// separators, branch/region styling, autofit.

const { createCanvas } = require("canvas");

function fmtNum(n) {
  if (n === null || n === undefined || n === "") return "";
  return Number(n).toLocaleString("id-ID");
}
function fmtPct(n) {
  if (n === null || n === undefined || n === "") return "";
  return `${Number(n).toFixed(1)}%`;
}
function isNegativeNumberString(s) {
  if (s === null || s === undefined || s === "") return false;
  const v = Number(String(s).replace(/%/g,''));
  return !isNaN(v) && v < 0;
}

async function renderIOREPS(rowsRaw) {
  // rowsRaw: array from iorepsquery.getIOREPSData
  // Build visible rows array with consistent ordering and values formatted later
  const rows = rowsRaw.map(r => r); // keep objects

  // Headers
  const headerTop = [
    "Cluster",
    "IO", "RE", "PS",
    "%RE to IO", "%PS to IO", "%PS to RE"
  ];

  const headerBottom = [
    "", // cluster
    "Act", "Daily", "MoM",     // IO
    "Act", "Daily", "MoM",     // RE
    "Act", "Daily", "MoM",     // PS
    "Act", "ppt",              // %RE to IO
    "Act", "ppt",              // %PS to IO
    "Act", "ppt"               // %PS to RE
  ];

  // Column count = 1 + 3 + 3 + 3 + 2 + 2 + 2 = 16
  const colCount = headerBottom.length; // 16

  // Create data matrix (visible cells) and keep level (cluster/branch/region/separator)
  const matrix = rows.map(r => {
    if (r.level === 'separator') return { separator: true };

    // build values:
    const IO_ACT = fmtNum(r.IO_ACT);
    const IO_DAILY = fmtNum(Math.round(Number(r.IO_DAILY || 0)));
    const IO_MoM = fmtPct(r.IO_MoM);

    const RE_ACT = fmtNum(r.RE_ACT);
    const RE_DAILY = fmtNum(Math.round(Number(r.RE_DAILY || 0)));
    const RE_MoM = fmtPct(r.RE_MoM);

    const PS_ACT = fmtNum(r.PS_ACT);
    const PS_DAILY = fmtNum(Math.round(Number(r.PS_DAILY || 0)));
    const PS_MoM = fmtPct(r.PS_MoM);

    const RE_to_IO = fmtPct(r.RE_to_IO);
    const RE_to_IO_ppt = fmtPct(r.RE_to_IO_PPT);

    const PS_to_IO = fmtPct(r.PS_to_IO);
    const PS_to_IO_ppt = fmtPct(r.PS_to_IO_PPT);

    const PS_to_RE = fmtPct(r.PS_to_RE);
    const PS_to_RE_ppt = fmtPct(r.PS_to_RE_PPT);

    return {
      cells: [
        r.label,
        IO_ACT, IO_DAILY, IO_MoM,
        RE_ACT, RE_DAILY, RE_MoM,
        PS_ACT, PS_DAILY, PS_MoM,
        RE_to_IO, RE_to_IO_ppt,
        PS_to_IO, PS_to_IO_ppt,
        PS_to_RE, PS_to_RE_ppt
      ],
      level: r.level
    };
  });

  // AUTO-FIT widths
  const font = "16px Arial";
  const padding = 12;
  const tmp = createCanvas(10,10);
  const ctx2 = tmp.getContext("2d");
  ctx2.font = font;

  // measure widths for headers and data
  const colWidths = Array(colCount).fill(0).map((_,i) => {
    const headerW = Math.max(
      ctx2.measureText(headerBottom[i] || "").width,
      ctx2.measureText(headerTop[Math.floor(i/3)] || "").width // approximate top header width
    );
    const dataW = Math.max(...matrix.map(r => {
      if (r.separator) return 0;
      const v = String(r.cells[i] || "");
      return ctx2.measureText(v).width;
    }), 0);
    return Math.max(headerW, dataW) + padding * 2;
  });

  // Ensure minimum widths for readability
  for (let i=0;i<colWidths.length;i++){
    colWidths[i] = Math.max(colWidths[i], 70);
  }

  const rowH = 40;
  const headerTopH = 36;
  const headerBottomH = 36;

  const totalW = colWidths.reduce((a,b)=>a+b,0);
  const totalH = headerTopH + headerBottomH + matrix.length * rowH;

  const canvas = createCanvas(totalW, totalH);
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,totalW,totalH);

  // draw top header (merged)
  let x = 0, y = 0;
  ctx.font = "bold 16px Arial";
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0,0,totalW,headerTopH);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // top header spans -- we must map exactly:
  // Cluster (col 0)
  // IO spans cols 1..3 (Act,Daily,MoM)
  // RE spans 4..6
  // PS spans 7..9
  // %RE to IO spans 10..11
  // %PS to IO spans 12..13
  // %PS to RE spans 14..15

  const spans = [
    {label: "Cluster", from:0, to:0},
    {label: "IO", from:1, to:3},
    {label: "RE", from:4, to:6},
    {label: "PS", from:7, to:9},
    {label: "%RE to IO", from:10, to:11},
    {label: "%PS to IO", from:12, to:13},
    {label: "%PS to RE", from:14, to:15}
  ];

  spans.forEach(sp => {
    const startX = colWidths.slice(0, sp.from).reduce((a,b)=>a+b,0);
    const width = colWidths.slice(sp.from, sp.to+1).reduce((a,b)=>a+b,0);
    ctx.strokeStyle = "#d0d0d0";
    ctx.strokeRect(startX, y, width, headerTopH);
    ctx.fillStyle = "#000";
    ctx.fillText(sp.label, startX + width/2, y + headerTopH/2);
  });

  // bottom header
  y += headerTopH;
  x = 0;
  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(0,y,totalW,headerBottomH);
  ctx.fillStyle = "#000";

  for (let i=0;i<colCount;i++){
    ctx.strokeStyle = "#d0d0d0";
    ctx.strokeRect(x, y, colWidths[i], headerBottomH);
    ctx.fillText(headerBottom[i], x + colWidths[i]/2, y + headerBottomH/2);
    x += colWidths[i];
  }

  // data rows
  y += headerBottomH;
  ctx.font = "14px Arial";

  matrix.forEach((r, rowIdx) => {
    x = 0;
    // separator row
    if (r.separator) {
      // draw empty row with borders
      for (let c=0;c<colCount;c++){
        ctx.strokeStyle = "#e8e8e8";
        ctx.strokeRect(x, y, colWidths[c], rowH);
        x += colWidths[c];
      }
      y += rowH;
      return;
    }

    // row background for branch/region
    if (r.level === 'branch') {
      ctx.fillStyle = "#f6f6f6";
      ctx.fillRect(0, y, totalW, rowH);
    } else if (r.level === 'region') {
      ctx.fillStyle = "#fff4cc";
      ctx.fillRect(0, y, totalW, rowH);
    }

    // draw cells
    for (let c=0;c<colCount;c++){
      const val = r.cells[c] === null || r.cells[c] === undefined ? "" : String(r.cells[c]);
      ctx.strokeStyle = "#e8e8e8";
      ctx.strokeRect(x, y, colWidths[c], rowH);

      // color rules: MoM cols are indexes 3,6,9 ; ppt cols indexes 11,13,15
      const isMoM = [3,6,9].includes(c);
      const isPPT = [11,13,15].includes(c);

      let neg = false;
      if (isMoM || isPPT) {
        neg = isNegativeNumberString(val);
      } else {
        neg = isNegativeNumberString(val);
      }

      ctx.fillStyle = neg ? "red" : "#000";

      // bold for branch/region rows
      if (r.level === 'branch' || r.level === 'region') {
        ctx.font = "bold 14px Arial";
      } else {
        ctx.font = "14px Arial";
      }

      ctx.fillText(val, x + colWidths[c]/2, y + rowH/2);

      x += colWidths[c];
    }

    y += rowH;
  });

  return canvas.toBuffer("image/png");
}

module.exports = { renderIOREPS };
