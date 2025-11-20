// iochannelquery.js — FINAL FIX
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

async function getIOChannelData(selectedDate) {
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

  // -------------------------------------------------------------------------
  // TEMPLATE QUERY (Cluster, Branch, Region)
  // -------------------------------------------------------------------------
  function baseSQL(levelField) {
    return `
      SELECT
        ${levelField} AS label,

        SUM(CASE WHEN \`new_channel\` = 'Agency' THEN ACT ELSE 0 END) AS Agency_MTD,
        SUM(CASE WHEN \`new_channel\` = 'Agency' THEN LM  ELSE 0 END) AS Agency_LM,

        SUM(CASE WHEN \`new_channel\` = 'Grapari' THEN ACT ELSE 0 END) AS Grapari_MTD,
        SUM(CASE WHEN \`new_channel\` = 'Grapari' THEN LM  ELSE 0 END) AS Grapari_LM,

        SUM(CASE WHEN \`new_channel\` IN ${B2B2C_LIST} THEN ACT ELSE 0 END) AS B2B2C_MTD,
        SUM(CASE WHEN \`new_channel\` IN ${B2B2C_LIST} THEN LM  ELSE 0 END) AS B2B2C_LM,

        SUM(CASE WHEN \`new_channel\` = 'Web & Apps' THEN ACT ELSE 0 END) AS WebApps_MTD,
        SUM(CASE WHEN \`new_channel\` = 'Web & Apps' THEN LM  ELSE 0 END) AS WebApps_LM,

        SUM(CASE WHEN \`new_channel\` = 'SOBI Affiliate' THEN ACT ELSE 0 END) AS Sobi_MTD,
        SUM(CASE WHEN \`new_channel\` = 'SOBI Affiliate' THEN LM  ELSE 0 END) AS Sobi_LM,

        SUM(ACT) AS ALL_MTD,
        SUM(LM)  AS ALL_LM,

        SUM(THIS_YTD) AS THIS_YTD,
        SUM(LAST_YTD) AS LAST_YTD

      FROM (
        SELECT 
          ${levelField},
          \`new_channel\`,
          io_date,

          SUM(CASE WHEN io_date BETWEEN '${ACT_START}' AND '${ACT_END}' THEN jml_io ELSE 0 END) AS ACT,
          SUM(CASE WHEN io_date BETWEEN '${LM_START}'  AND '${LM_END}'  THEN jml_io ELSE 0 END) AS LM,

          SUM(CASE WHEN io_date BETWEEN '${YTD_START}' AND '${ACT_END}' THEN jml_io ELSE 0 END) AS THIS_YTD,
          SUM(CASE WHEN io_date BETWEEN '${LAST_YTD_START}' AND '${LAST_YTD_END}' THEN jml_io ELSE 0 END) AS LAST_YTD

        FROM fmc_mirror.ih_io_summary
        WHERE region = 'EASTERN JABOTABEK'
          AND product NOT IN ('HWA')
        GROUP BY ${levelField}, \`new_channel\`, io_date
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

        Agency_MTD: r.Agency_MTD,
        Agency_LM: r.Agency_LM,
        Agency_MoM: calcMoM(r.Agency_MTD, r.Agency_LM),
        Agency_Cont: calcCont(r.Agency_MTD, ALL_MTD),

        Grapari_MTD: r.Grapari_MTD,
        Grapari_LM: r.Grapari_LM,
        Grapari_MoM: calcMoM(r.Grapari_MTD, r.Grapari_LM),
        Grapari_Cont: calcCont(r.Grapari_MTD, ALL_MTD),

        B2B2C_MTD: r.B2B2C_MTD,
        B2B2C_LM: r.B2B2C_LM,
        B2B2C_MoM: calcMoM(r.B2B2C_MTD, r.B2B2C_LM),
        B2B2C_Cont: calcCont(r.B2B2C_MTD, ALL_MTD),

        WebApps_MTD: r.WebApps_MTD,
        WebApps_LM: r.WebApps_LM,
        WebApps_MoM: calcMoM(r.WebApps_MTD, r.WebApps_LM),
        WebApps_Cont: calcCont(r.WebApps_MTD, ALL_MTD),

        Sobi_MTD: r.Sobi_MTD,
        Sobi_LM: r.Sobi_LM,
        Sobi_MoM: calcMoM(r.Sobi_MTD, r.Sobi_LM),
        Sobi_Cont: calcCont(r.Sobi_MTD, ALL_MTD),

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

module.exports = { getIOChannelData };
