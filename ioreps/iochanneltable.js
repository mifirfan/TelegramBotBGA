// iochanneltable.js
// Renders Canvas table for IO Channel summary with 3-level headers (top/mid/bottom).
const { createCanvas } = require("canvas");

// formatting helpers
function fmtNum(v) {
  if (v === null || v === undefined) return "0";
  if (isNaN(v)) return String(v);
  return Number(v).toLocaleString("id-ID");
}
function fmtPct(v) {
  if (v === null || v === undefined) return "0%";
  return Number(v).toFixed(1) + "%";
}

async function renderIOChannel(rows) {
  // rows: array returned from getIOChannelData

  // ====== headers (3 levels) ======
  // Total columns = 19:
  // 0: Cluster
  // 1-3 Agency
  // 4-6 Grapari
  // 7-9 B2B2C & Others
  // 10-12 Web & Apps
  // 13-15 SOBI Affiliate
  // 16-18 All

  const colCount = 19;

  const headerTop = [
    "Cluster",
    "Non Digital", "", "", "", "", "", "", "",
    "Digital", "", "", "", "", "",
    "All", "", ""
  ];

  const headerMid = [
    "   ",
    "Agency", "", "",
    "Grapari", "", "",
    "B2B2C & Others", "", "",
    "Web & Apps", "", "",
    "SOBI Affiliate", "", "",
    "   ", "", ""
  ];

  const headerBottom = [
    "   ",
    "Mtd","MoM","Cont",
    "Mtd","MoM","Cont",
    "Mtd","MoM","Cont",
    "Mtd","MoM","Cont",
    "Mtd","MoM","Cont",
    "Mtd","MoM","Ytd"
  ];

  // merged spans for top and mid (maps label -> [start,end])
  const mergedTop = {
    "Cluster": [0,0],
    "Non Digital": [1,9],
    "Digital": [10,15],
    "All": [16,18]
  };
  const mergedMid = {
    "Null1": [0,0],
    "Agency": [1,3],
    "Grapari": [4,6],
    "B2B2C & Others": [7,9],
    "Web & Apps": [10,12],
    "SOBI Affiliate": [13,15],
    "Null2": [16,18]
  };

  // build matrix (strings)
  const matrix = rows.map(r => {
    if (r.separator) return new Array(colCount).fill("");
    return [
      r.label,

      // Agency
      fmtNum(r.Agency_MTD), fmtPct(r.Agency_MoM), fmtPct(r.Agency_Cont),
      // Grapari
      fmtNum(r.Grapari_MTD), fmtPct(r.Grapari_MoM), fmtPct(r.Grapari_Cont),
      // B2B2C & Others
      fmtNum(r.B2B2C_MTD), fmtPct(r.B2B2C_MoM), fmtPct(r.B2B2C_Cont),
      // Web & Apps
      fmtNum(r.WebApps_MTD), fmtPct(r.WebApps_MoM), fmtPct(r.WebApps_Cont),
      // SOBI Affiliate
      fmtNum(r.Sobi_MTD), fmtPct(r.Sobi_MoM), fmtPct(r.Sobi_Cont),
      // All
      fmtNum(r.ALL_MTD), fmtPct(r.ALL_MoM), fmtPct(r.ALL_YTD)
    ];
  });

  // measure widths (autofit)
  const tmp = createCanvas(10,10);
  const ctx2 = tmp.getContext("2d");
  const font = "16px Arial";
  ctx2.font = font;
  const padding = 12;

  const colWidths = new Array(colCount).fill(0).map((_,i) => {
    const wTop = ctx2.measureText(headerTop[i] || "").width;
    const wMid = ctx2.measureText(headerMid[i] || "").width;
    const wBot = ctx2.measureText(headerBottom[i] || "").width;
    const wData = Math.max(...matrix.map(r => ctx2.measureText(String(r[i]||"")).width));
    return Math.max(wTop, wMid, wBot, wData) + padding*2;
  });

  // ensure minimum widths
  for (let i=0;i<colCount;i++) colWidths[i] = Math.max(colWidths[i], 64);

  const headerTopH = 30;
  const headerMidH = 28;
  const headerBotH = 28;
  const rowH = 40;

  const W = colWidths.reduce((a,b)=>a+b,0);
  const H = headerTopH + headerMidH + headerBotH + matrix.length * rowH;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,W,H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // draw top header (merged)
  ctx.font = "bold 14px Arial";
  let x = 0, y = 0;
  ctx.fillStyle = "#e9e9e9";
  ctx.fillRect(0, 0, W, headerTopH);
  ctx.strokeStyle = "#d0d0d0";

  // draw each mergedTop span
  Object.entries(mergedTop).forEach(([k, range]) => {
    const [s,e] = range;
    const startX = colWidths.slice(0, s).reduce((a,b)=>a+b,0);
    const width = colWidths.slice(s, e+1).reduce((a,b)=>a+b,0);
    ctx.strokeRect(startX, y, width, headerTopH);
    ctx.fillStyle = "#000";
    ctx.fillText(k, startX + width/2, y + headerTopH/2);
  });

  // mid header
  y += headerTopH;
  ctx.font = "bold 13px Arial";
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, y, W, headerMidH);

  Object.entries(mergedMid).forEach(([k, range]) => {
    const [s,e] = range;
    const startX = colWidths.slice(0, s).reduce((a,b)=>a+b,0);
    const width = colWidths.slice(s, e+1).reduce((a,b)=>a+b,0);
    ctx.strokeRect(startX, y, width, headerMidH);
    ctx.fillStyle = "#000";
    ctx.fillText(k, startX + width/2, y + headerMidH/2);
  });

  // bottom header (individual columns)
  y += headerMidH;
  ctx.font = "bold 12px Arial";
  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(0, y, W, headerBotH);

  x = 0;
  for (let i=0;i<colCount;i++){
    ctx.strokeRect(x, y, colWidths[i], headerBotH);
    ctx.fillStyle = "#000";
    ctx.fillText(headerBottom[i] || "", x + colWidths[i]/2, y + headerBotH/2);
    x += colWidths[i];
  }

  // data rows
  y += headerBotH;
  ctx.font = "14px Arial";

  matrix.forEach(row => {
    x = 0;

    if (row[0] === "") {
      // separator row
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, y, W, rowH);
      ctx.strokeStyle = "#eee";
      for (let c=0;c<colCount;c++){
        ctx.strokeRect(x, y, colWidths[c], rowH);
        x += colWidths[c];
      }
      y += rowH;
      return;
    }

    // row background for branch or region
    // we don't have level here: check original rows array to find it
    const original = rows.shift ? null : null; // no-op placeholder

    for (let c=0;c<colCount;c++){
      const text = String(row[c] || "");
      const neg = text.includes("-");

      ctx.strokeStyle = "#eee";
      ctx.strokeRect(x, y, colWidths[c], rowH);
      ctx.fillStyle = neg ? "red" : "#000";
      ctx.fillText(text, x + colWidths[c]/2, y + rowH/2);
      x += colWidths[c];
    }

    y += rowH;
  });

  return canvas.toBuffer("image/png");
}

module.exports = { renderIOChannel };
