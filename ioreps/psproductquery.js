// psproductquery.js — FINAL FIX
// Sudah termasuk THIS_YTD, LAST_YTD, dan YTD Growth %

const pool = require("../database");



// Helper date range
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

  const YTD_START = `${year}-01-01`;

  // YTD tahun lalu (last YTD)
  const LAST_YTD_START = `${year - 1}-01-01`;
  const LAST_YTD_END = `${year - 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    ACT_START,
    ACT_END,
    LM_START,
    LM_END,
    YTD_START,
    LAST_YTD_START,
    LAST_YTD_END,
  };
}

async function getPSProductData(selectedDate) {
  const {
    ACT_START,
    ACT_END,
    LM_START,
    LM_END,
    YTD_START,
    LAST_YTD_START,
    LAST_YTD_END,
  } = getLastMonthRange(selectedDate);

  console.log("ACT RANGE:", ACT_START, "→", ACT_END);
  console.log("LM  RANGE:", LM_START, "→", LM_END);
  console.log("YTD RANGE:", YTD_START, "→", ACT_END);
  console.log("LY  RANGE:", LAST_YTD_START, "→", LAST_YTD_END);

  const B2B2C_LIST = `('B2B2C','Others','Mochan','Sbp/Outlet')`;
  const EZnet_LIST = `('EZnet RTRW','IH Lite/EZnet')`;
  const TselOne_LIST = `('Telkomsel One Complete','Telkomsel One Dynamic')`
  const TselDragon_LIST = `('Telkomsel One Complete','Telkomsel One Dynamic','Dragon')`

  // -------------------------------------------------------------------------
  // TEMPLATE QUERY (Cluster, Branch, Region)
  // -------------------------------------------------------------------------
  function baseSQL(levelField) {
    return `
      SELECT
        ${levelField} AS label,

        SUM(CASE WHEN \`product\` = 'IH Reguler' THEN ACT ELSE 0 END) AS IHReguler_MTD,
        SUM(CASE WHEN \`product\` = 'IH Reguler' THEN LM  ELSE 0 END) AS IHReguler_LM,

        SUM(CASE WHEN \`product\` IN ${EZnet_LIST} THEN ACT ELSE 0 END) AS EZnet_MTD,
        SUM(CASE WHEN \`product\` IN ${EZnet_LIST} THEN LM  ELSE 0 END) AS EZnet_LM,

        SUM(CASE WHEN \`product\` IN ${B2B2C_LIST} THEN ACT ELSE 0 END) AS B2B2C_MTD,
        SUM(CASE WHEN \`product\` IN ${B2B2C_LIST} THEN LM  ELSE 0 END) AS B2B2C_LM,

        SUM(CASE WHEN \`product\` = 'Dragon' THEN ACT ELSE 0 END) AS Dragon_MTD,
        SUM(CASE WHEN \`product\` = 'Dragon' THEN LM  ELSE 0 END) AS Dragon_LM,

        SUM(CASE WHEN \`product\` IN ${TselOne_LIST} THEN ACT ELSE 0 END) AS TselOne_MTD,
        SUM(CASE WHEN \`product\` IN ${TselOne_LIST} THEN LM  ELSE 0 END) AS TselOne_LM,
        
        SUM(CASE WHEN \`product\` IN ${TselDragon_LIST} THEN ACT ELSE 0 END) AS TselDragon_MTD,
        SUM(CASE WHEN \`product\` IN ${TselDragon_LIST} THEN LM  ELSE 0 END) AS TselDragon_LM,

        SUM(ACT) AS ALL_MTD,
        SUM(LM)  AS ALL_LM,

        SUM(THIS_YTD) AS THIS_YTD,
        SUM(LAST_YTD) AS LAST_YTD

      FROM (
        SELECT 
          ${levelField},
          \`product\`,
          ps_date,

          SUM(CASE WHEN ps_date BETWEEN '${ACT_START}' AND '${ACT_END}' THEN jml_ps ELSE 0 END) AS ACT,
          SUM(CASE WHEN ps_date BETWEEN '${LM_START}'  AND '${LM_END}'  THEN jml_ps ELSE 0 END) AS LM,

          SUM(CASE WHEN ps_date BETWEEN '${YTD_START}' AND '${ACT_END}' THEN jml_ps ELSE 0 END) AS THIS_YTD,
          SUM(CASE WHEN ps_date BETWEEN '${LAST_YTD_START}' AND '${LAST_YTD_END}' THEN jml_ps ELSE 0 END) AS LAST_YTD

        FROM fmc_mirror.ih_ps_summary
        WHERE region = 'EASTERN JABOTABEK'
          AND product NOT IN ('HWA')
        GROUP BY ${levelField}, \`product\`, ps_date
      ) base
      GROUP BY ${levelField}
    `;
  }

  const [clusterRows] = await pool.query(
    baseSQL("cluster") +
      ` ORDER BY FIELD(cluster,'KOTA BEKASI','DEPOK','BOGOR','SUKABUMI','BEKASI','KARAWANG PURWAKARTA')`
  );

  const [branchRows] = await pool.query(baseSQL("branch") + ` ORDER BY branch`);

  const [regionRows] = await pool.query(
    baseSQL(`'EASTERN JABOTABEK'`) // label tetap satu baris
  );

  // -------------------------------------------------------------------------
  // Perhitungan
  // -------------------------------------------------------------------------
  function calcMoM(act, lm) {
    if (!lm || lm === 0) return 0;
    return Number((((act - lm) / lm) * 100).toFixed(1));
  }

  function calcCont(channel, total) {
    if (!total || total === 0) return 0;
    return Number(((channel / total) * 100).toFixed(1));
  }

  function calcYTDGrowth(thisYTD, lastYTD) {
    if (!lastYTD || lastYTD === 0) return 0;
    return Number((((thisYTD / lastYTD) - 1) * 100).toFixed(1));
  }

  function convert(rows) {
    return rows.map((r) => {
      const ALL_MTD = Number(r.ALL_MTD || 0);
      const ALL_LM = Number(r.ALL_LM || 0);

      const THIS_YTD = Number(r.THIS_YTD || 0);
      const LAST_YTD = Number(r.LAST_YTD || 0);

      return {
        label: r.label,

        IHReguler_MTD: r.IHReguler_MTD,
        IHReguler_LM: r.IHReguler_LM,
        IHReguler_MoM: calcMoM(r.IHReguler_MTD, r.IHReguler_LM),
        IHReguler_Cont: calcCont(r.IHReguler_MTD, ALL_MTD),

        EZnet_MTD: r.EZnet_MTD,
        EZnet_LM: r.EZnet_LM,
        EZnet_MoM: calcMoM(r.EZnet_MTD, r.EZnet_LM),
        EZnet_Cont: calcCont(r.EZnet_MTD, ALL_MTD),

        Dragon_MTD: r.Dragon_MTD,
        Dragon_LM: r.Dragon_LM,
        Dragon_MoM: calcMoM(r.Dragon_MTD, r.Dragon_LM),
        Dragon_Cont: calcCont(r.Dragon_MTD, ALL_MTD),

        TselOne_MTD: r.TselOne_MTD,
        TselOne_LM: r.TselOne_LM,
        TselOne_MoM: calcMoM(r.TselOne_MTD, r.TselOne_LM),
        TselOne_Cont: calcCont(r.TselOne_MTD, ALL_MTD),
        
        TselDragon_MTD: r.TselDragon_MTD,
        TselDragon_LM: r.TselDragon_LM,
        TselDragon_MoM: calcMoM(r.TselDragon_MTD, r.TselDragon_LM),
        TselDragon_Cont: calcCont(r.TselDragon_MTD, ALL_MTD),

        ALL_MTD,
        ALL_LM,
        ALL_MoM: calcMoM(ALL_MTD, ALL_LM),

        // ⭐ HASIL AKHIR YTD GROWTH %
        ALL_YTD: calcYTDGrowth(THIS_YTD, LAST_YTD),
      };
    });
  }

  const clusters = convert(clusterRows);
  const branches = convert(branchRows);
  const regions = convert(regionRows);

  return [...clusters, { separator: true }, ...branches, { separator: true }, ...regions];
}

module.exports = { getPSProductData };