// =======================================
// iorepsquery.js — FINAL VERSION
// =======================================

const pool = require("../database");

// -------------------------------------------------------
// Helper: hitung ACT & LM range + ACT_END (hari di bulan)
// -------------------------------------------------------
function getLastMonthRange(selectedDate) {
    const d = new Date(selectedDate);

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();

    const lmMonth = month === 1 ? 12 : month - 1;
    const lmYear = month === 1 ? year - 1 : year;

    const lastDayLM = new Date(lmYear, lmMonth, 0).getDate();
    const safeDay = Math.min(day, lastDayLM);

    const ACT_START = `${year}-${String(month).padStart(2, "0")}-01`;
    const ACT_END = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const LM_START = `${lmYear}-${String(lmMonth).padStart(2, "0")}-01`;
    const LM_END = `${lmYear}-${String(lmMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;

    return { ACT_START, ACT_END, LM_START, LM_END, ACT_END_DAY: day };
}

// -------------------------------------------------------
// Query Final IOREPS (Cluster + Branch + Region)
// -------------------------------------------------------
async function getIOREPSData(selectedDate) {
    const { ACT_START, ACT_END, LM_START, LM_END, ACT_END_DAY } =
        getLastMonthRange(selectedDate);

    console.log("ACT RANGE:", ACT_START, "→", ACT_END);
    console.log("LM  RANGE:", LM_START, "→", LM_END);

    // ------------------------------
    // QUERY CLUSTER
    // ------------------------------
    const clusterSQL = `
        SELECT
            cluster AS label,
            type,

            SUM(CASE WHEN tgl BETWEEN '${ACT_START}' AND '${ACT_END}' THEN jml END) AS ACT,
            SUM(CASE WHEN tgl BETWEEN '${LM_START}' AND '${LM_END}' THEN jml END) AS LM

        FROM fmc_mirror.ih_ioreps_dd
        WHERE region = 'EASTERN JABOTABEK'
        GROUP BY cluster, type
        ORDER BY FIELD(cluster,
            'Kota Bekasi',
            'Depok',
            'Bogor',
            'Sukabumi',
            'Bekasi',
            'Karawang Purwakarta'
        )
    `;

    const [clusterRows] = await pool.query(clusterSQL);

    // ------------------------------
    // QUERY BRANCH
    // ------------------------------
    const branchSQL = `
        SELECT
            branch AS label,
            type,

            SUM(CASE WHEN tgl BETWEEN '${ACT_START}' AND '${ACT_END}' THEN jml END) AS ACT,
            SUM(CASE WHEN tgl BETWEEN '${LM_START}' AND '${LM_END}' THEN jml END) AS LM

        FROM fmc_mirror.ih_ioreps_dd
        WHERE region = 'EASTERN JABOTABEK'
        GROUP BY branch, type
        ORDER BY branch
    `;

    const [branchRows] = await pool.query(branchSQL);

    // ------------------------------
    // QUERY REGION
    // ------------------------------
    const regionSQL = `
        SELECT
            'EASTERN JABOTABEK' AS label,
            type,

            SUM(CASE WHEN tgl BETWEEN '${ACT_START}' AND '${ACT_END}' THEN jml END) AS ACT,
            SUM(CASE WHEN tgl BETWEEN '${LM_START}' AND '${LM_END}' THEN jml END) AS LM

        FROM fmc_mirror.ih_ioreps_dd
        WHERE region = 'EASTERN JABOTABEK'
        GROUP BY type
    `;

    const [regionRows] = await pool.query(regionSQL);

    // ---------------------------------------------------------
    // Convert base rows → final rows (ACT, LM, MoM, Daily, Ratio, PPT)
    // ---------------------------------------------------------
    function convertRows(rows) {
        const map = {};

        rows.forEach(r => {
            if (!map[r.label]) {
                map[r.label] = {
                    label: r.label,
                    IO_ACT: 0, IO_LM: 0,
                    RE_ACT: 0, RE_LM: 0,
                    PS_ACT: 0, PS_LM: 0,

                    IO_MoM: 0,
                    RE_MoM: 0,
                    PS_MoM: 0,

                    IO_DAILY: 0,
                    RE_DAILY: 0,
                    PS_DAILY: 0,

                    RE_to_IO_ACT: 0,
                    PS_to_IO_ACT: 0,
                    PS_to_RE_ACT: 0,

                    RE_to_IO_PPT: 0,
                    PS_to_IO_PPT: 0,
                    PS_to_RE_PPT: 0
                };
            }

            const row = map[r.label];

            if (r.type === "IO") {
                row.IO_ACT = r.ACT || 0;
                row.IO_LM = r.LM || 0;
            }
            if (r.type === "RE") {
                row.RE_ACT = r.ACT || 0;
                row.RE_LM = r.LM || 0;
            }
            if (r.type === "PS") {
                row.PS_ACT = r.ACT || 0;
                row.PS_LM = r.LM || 0;
            }
        });

        // Hitung semua metrik
        Object.values(map).forEach(r => {

            // MoM %
            r.IO_MoM = calcMom(r.IO_ACT, r.IO_LM);
            r.RE_MoM = calcMom(r.RE_ACT, r.RE_LM);
            r.PS_MoM = calcMom(r.PS_ACT, r.PS_LM);

            // Daily (tanpa decimal)
            r.IO_DAILY = Math.round(r.IO_ACT / ACT_END_DAY);
            r.RE_DAILY = Math.round(r.RE_ACT / ACT_END_DAY);
            r.PS_DAILY = Math.round(r.PS_ACT / ACT_END_DAY);

            // Ratio ACT %
            r.RE_to_IO_ACT = ratio(r.RE_ACT, r.IO_ACT);
            r.PS_to_IO_ACT = ratio(r.PS_ACT, r.IO_ACT);
            r.PS_to_RE_ACT = ratio(r.PS_ACT, r.RE_ACT);

            // PPT = ACT ratio difference - LM ratio difference
            r.RE_to_IO_PPT = ppt(r.RE_ACT, r.IO_ACT, r.RE_LM, r.IO_LM);
            r.PS_to_IO_PPT = ppt(r.PS_ACT, r.IO_ACT, r.PS_LM, r.IO_LM);
            r.PS_to_RE_PPT = ppt(r.PS_ACT, r.RE_ACT, r.PS_LM, r.RE_LM);
        });

        return Object.values(map);
    }

    // --- helper untuk MoM ---
    function calcMom(act, lm) {
        if (!lm || lm === 0) return 0;
        return Number((((act - lm) / lm) * 100).toFixed(1));
    }

    // --- helper ratio % ---
    function ratio(a, b) {
        if (!b || b === 0) return 0;
        return Number(((a / b) * 100).toFixed(1));
    }

    // --- helper ppt ---
    function ppt(actA, actB, lmA, lmB) {
        const actRatio = ratio(actA, actB);
        const lmRatio = ratio(lmA, lmB);
        return Number((actRatio - lmRatio).toFixed(1));
    }

    // ---------------------------
    // Gabungkan cluster → branch → region
    // ---------------------------
    return [
        ...convertRows(clusterRows),

        { separator: true },  // jeda

        ...convertRows(branchRows),

        { separator: true },  // jeda

        ...convertRows(regionRows)
    ];
}

module.exports = { getIOREPSData };
