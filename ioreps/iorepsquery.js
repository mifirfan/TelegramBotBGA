// iorepsquery.js (FINAL)
// Produces rows: label, level, IO_ACT, IO_LM, IO_MoM, IO_DAILY, RE_ACT, RE_LM, RE_MoM, RE_DAILY,
// PS_ACT, PS_LM, PS_MoM, PS_DAILY,
// RE_to_IO, RE_to_IO_LM, RE_to_IO_PPT, PS_to_IO, PS_to_IO_LM, PS_to_IO_PPT, PS_to_RE, PS_to_RE_LM, PS_to_RE_PPT

const pool = require("../database");

function getLastMonthRange(selectedDate) {
  const d = new Date(selectedDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  const lmMonth = month === 1 ? 12 : month - 1;
  const lmYear = month === 1 ? year - 1 : year;

  const lastDayLM = new Date(lmYear, lmMonth, 0).getDate();
  const safeDay = Math.min(day, lastDayLM);

  return {
    ACT_START: `${year}-${String(month).padStart(2,"0")}-01`,
    ACT_END:   `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
    LM_START:  `${lmYear}-${String(lmMonth).padStart(2,"0")}-01`,
    LM_END:    `${lmYear}-${String(lmMonth).padStart(2,"0")}-${String(safeDay).padStart(2,"0")}`,
    ACT_END_DAY: day
  };
}

async function getIOREPSData(selectedDate) {
  const R = getLastMonthRange(selectedDate);
  const dayCount = R.ACT_END_DAY;

  console.log("ACT RANGE:", R.ACT_START, "→", R.ACT_END);
  console.log("LM  RANGE:", R.LM_START, "→", R.LM_END);

  // Helper subquery base returns ACT and LM by grouping entity + type
  // 1) CLUSTER
  const clusterSQL = `
    SELECT
      cluster AS label,
      'cluster' AS level,
      SUM(CASE WHEN type='IO' THEN ACT ELSE 0 END) AS IO_ACT,
      SUM(CASE WHEN type='IO' THEN LM  ELSE 0 END) AS IO_LM,
      ROUND(
        (SUM(CASE WHEN type='IO' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='IO' THEN LM ELSE 0 END))
        / NULLIF(SUM(CASE WHEN type='IO' THEN LM ELSE 0 END),0) * 100,1
      ) AS IO_MoM,

      SUM(CASE WHEN type='RE' THEN ACT ELSE 0 END) AS RE_ACT,
      SUM(CASE WHEN type='RE' THEN LM  ELSE 0 END) AS RE_LM,
      ROUND(
        (SUM(CASE WHEN type='RE' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='RE' THEN LM ELSE 0 END))
        / NULLIF(SUM(CASE WHEN type='RE' THEN LM ELSE 0 END),0) * 100,1
      ) AS RE_MoM,

      SUM(CASE WHEN type='PS' THEN ACT ELSE 0 END) AS PS_ACT,
      SUM(CASE WHEN type='PS' THEN LM  ELSE 0 END) AS PS_LM,
      ROUND(
        (SUM(CASE WHEN type='PS' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='PS' THEN LM ELSE 0 END))
        / NULLIF(SUM(CASE WHEN type='PS' THEN LM ELSE 0 END),0) * 100,1
      ) AS PS_MoM

    FROM (
      SELECT cluster, type,
        SUM(CASE WHEN tgl BETWEEN '${R.ACT_START}' AND '${R.ACT_END}' THEN jml ELSE 0 END) AS ACT,
        SUM(CASE WHEN tgl BETWEEN '${R.LM_START}'  AND '${R.LM_END}'  THEN jml ELSE 0 END) AS LM
      FROM fmc_mirror.ih_ioreps_dd
      WHERE region = 'EASTERN JABOTABEK'
      GROUP BY cluster, type
    ) AS base
    GROUP BY cluster
    ORDER BY FIELD(cluster,
      'Kota Bekasi','Depok','Bogor','Sukabumi','Bekasi','Karawang Purwakarta');
  `;

  const [clusterRows] = await pool.query(clusterSQL);

  // compute ratios and daily for clusters
  const clustersFinal = clusterRows.map(r => {
    const ioAct = Number(r.IO_ACT || 0);
    const ioLm  = Number(r.IO_LM  || 0);
    const reAct = Number(r.RE_ACT || 0);
    const reLm  = Number(r.RE_LM  || 0);
    const psAct = Number(r.PS_ACT || 0);
    const psLm  = Number(r.PS_LM  || 0);

    const RE_to_IO = ioAct === 0 ? 0 : Number(((reAct / ioAct) * 100).toFixed(1));
    const RE_to_IO_LM = ioLm === 0 ? 0 : Number(((reLm / ioLm) * 100).toFixed(1));
    const RE_to_IO_PPT = Number((RE_to_IO - RE_to_IO_LM).toFixed(1));

    const PS_to_IO = ioAct === 0 ? 0 : Number(((psAct / ioAct) * 100).toFixed(1));
    const PS_to_IO_LM = ioLm === 0 ? 0 : Number(((psLm / ioLm) * 100).toFixed(1));
    const PS_to_IO_PPT = Number((PS_to_IO - PS_to_IO_LM).toFixed(1));

    const PS_to_RE = reAct === 0 ? 0 : Number(((psAct / reAct) * 100).toFixed(1));
    const PS_to_RE_LM = reLm === 0 ? 0 : Number(((psLm / reLm) * 100).toFixed(1));
    const PS_to_RE_PPT = Number((PS_to_RE - PS_to_RE_LM).toFixed(1));

    return {
      label: r.label,
      level: 'cluster',

      IO_ACT: ioAct,
      IO_LM: ioLm,
      IO_MoM: r.IO_MoM === null ? 0 : Number(r.IO_MoM),
      IO_DAILY: Math.round(ioAct / dayCount),

      RE_ACT: reAct,
      RE_LM: reLm,
      RE_MoM: r.RE_MoM === null ? 0 : Number(r.RE_MoM),
      RE_DAILY: Math.round(reAct / dayCount),

      PS_ACT: psAct,
      PS_LM: psLm,
      PS_MoM: r.PS_MoM === null ? 0 : Number(r.PS_MoM),
      PS_DAILY: Math.round(psAct / dayCount),

      RE_to_IO, RE_to_IO_LM, RE_to_IO_PPT,
      PS_to_IO, PS_to_IO_LM, PS_to_IO_PPT,
      PS_to_RE, PS_to_RE_LM, PS_to_RE_PPT
    };
  });

  // blank separator before branch
  const blank1 = [{ label: "", level: "separator" }];

  // 2) BRANCH
  const branchSQL = `
    SELECT
      branch AS label,
      SUM(CASE WHEN type='IO' THEN ACT ELSE 0 END) AS IO_ACT,
      SUM(CASE WHEN type='IO' THEN LM  ELSE 0 END) AS IO_LM,
      ROUND((SUM(CASE WHEN type='IO' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='IO' THEN LM ELSE 0 END)) / NULLIF(SUM(CASE WHEN type='IO' THEN LM ELSE 0 END),0)*100,1) AS IO_MoM,

      SUM(CASE WHEN type='RE' THEN ACT ELSE 0 END) AS RE_ACT,
      SUM(CASE WHEN type='RE' THEN LM  ELSE 0 END) AS RE_LM,
      ROUND((SUM(CASE WHEN type='RE' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='RE' THEN LM ELSE 0 END)) / NULLIF(SUM(CASE WHEN type='RE' THEN LM ELSE 0 END),0)*100,1) AS RE_MoM,

      SUM(CASE WHEN type='PS' THEN ACT ELSE 0 END) AS PS_ACT,
      SUM(CASE WHEN type='PS' THEN LM  ELSE 0 END) AS PS_LM,
      ROUND((SUM(CASE WHEN type='PS' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='PS' THEN LM ELSE 0 END)) / NULLIF(SUM(CASE WHEN type='PS' THEN LM ELSE 0 END),0)*100,1) AS PS_MoM

    FROM (
      SELECT branch, type,
        SUM(CASE WHEN tgl BETWEEN '${R.ACT_START}' AND '${R.ACT_END}' THEN jml ELSE 0 END) AS ACT,
        SUM(CASE WHEN tgl BETWEEN '${R.LM_START}'  AND '${R.LM_END}'  THEN jml ELSE 0 END) AS LM
      FROM fmc_mirror.ih_ioreps_dd
      WHERE region = 'EASTERN JABOTABEK'
      GROUP BY branch, type
    ) AS base
    GROUP BY branch
    ORDER BY branch;
  `;

  const [branchRows] = await pool.query(branchSQL);

  const branchesFinal = branchRows.map(r => {
    const ioAct = Number(r.IO_ACT || 0);
    const ioLm  = Number(r.IO_LM  || 0);
    const reAct = Number(r.RE_ACT || 0);
    const reLm  = Number(r.RE_LM  || 0);
    const psAct = Number(r.PS_ACT || 0);
    const psLm  = Number(r.PS_LM  || 0);

    const RE_to_IO = ioAct === 0 ? 0 : Number(((reAct / ioAct) * 100).toFixed(1));
    const RE_to_IO_LM = ioLm === 0 ? 0 : Number(((reLm / ioLm) * 100).toFixed(1));
    const RE_to_IO_PPT = Number((RE_to_IO - RE_to_IO_LM).toFixed(1));

    const PS_to_IO = ioAct === 0 ? 0 : Number(((psAct / ioAct) * 100).toFixed(1));
    const PS_to_IO_LM = ioLm === 0 ? 0 : Number(((psLm / ioLm) * 100).toFixed(1));
    const PS_to_IO_PPT = Number((PS_to_IO - PS_to_IO_LM).toFixed(1));

    const PS_to_RE = reAct === 0 ? 0 : Number(((psAct / reAct) * 100).toFixed(1));
    const PS_to_RE_LM = reLm === 0 ? 0 : Number(((psLm / reLm) * 100).toFixed(1));
    const PS_to_RE_PPT = Number((PS_to_RE - PS_to_RE_LM).toFixed(1));

    return {
      label: r.label,
      level: 'branch',

      IO_ACT: ioAct,
      IO_LM: ioLm,
      IO_MoM: r.IO_MoM === null ? 0 : Number(r.IO_MoM),
      IO_DAILY: Math.round(ioAct / dayCount),

      RE_ACT: reAct,
      RE_LM: reLm,
      RE_MoM: r.RE_MoM === null ? 0 : Number(r.RE_MoM),
      RE_DAILY: Math.round(reAct / dayCount),

      PS_ACT: psAct,
      PS_LM: psLm,
      PS_MoM: r.PS_MoM === null ? 0 : Number(r.PS_MoM),
      PS_DAILY: Math.round(psAct / dayCount),

      RE_to_IO, RE_to_IO_LM, RE_to_IO_PPT,
      PS_to_IO, PS_to_IO_LM, PS_to_IO_PPT,
      PS_to_RE, PS_to_RE_LM, PS_to_RE_PPT
    };
  });

  // blank before region
  const blank2 = [{ label: "", level: "separator" }];

  // 3) REGION total (EASTERN JABOTABEK)
  const regionSQL = `
    SELECT
      'EASTERN JABOTABEK' AS label,
      SUM(CASE WHEN type='IO' THEN ACT ELSE 0 END) AS IO_ACT,
      SUM(CASE WHEN type='IO' THEN LM  ELSE 0 END) AS IO_LM,
      ROUND((SUM(CASE WHEN type='IO' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='IO' THEN LM ELSE 0 END)) / NULLIF(SUM(CASE WHEN type='IO' THEN LM ELSE 0 END),0)*100,1) AS IO_MoM,

      SUM(CASE WHEN type='RE' THEN ACT ELSE 0 END) AS RE_ACT,
      SUM(CASE WHEN type='RE' THEN LM  ELSE 0 END) AS RE_LM,
      ROUND((SUM(CASE WHEN type='RE' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='RE' THEN LM ELSE 0 END)) / NULLIF(SUM(CASE WHEN type='RE' THEN LM ELSE 0 END),0)*100,1) AS RE_MoM,

      SUM(CASE WHEN type='PS' THEN ACT ELSE 0 END) AS PS_ACT,
      SUM(CASE WHEN type='PS' THEN LM  ELSE 0 END) AS PS_LM,
      ROUND((SUM(CASE WHEN type='PS' THEN ACT ELSE 0 END) - SUM(CASE WHEN type='PS' THEN LM ELSE 0 END)) / NULLIF(SUM(CASE WHEN type='PS' THEN LM ELSE 0 END),0)*100,1) AS PS_MoM

    FROM (
      SELECT type,
        SUM(CASE WHEN tgl BETWEEN '${R.ACT_START}' AND '${R.ACT_END}' THEN jml ELSE 0 END) AS ACT,
        SUM(CASE WHEN tgl BETWEEN '${R.LM_START}'  AND '${R.LM_END}'  THEN jml ELSE 0 END) AS LM
      FROM fmc_mirror.ih_ioreps_dd
      WHERE region = 'EASTERN JABOTABEK'
      GROUP BY type
    ) AS base;
  `;

  const [regionRows] = await pool.query(regionSQL);

  const regionsFinal = regionRows.map(r => {
    const ioAct = Number(r.IO_ACT || 0);
    const ioLm  = Number(r.IO_LM  || 0);
    const reAct = Number(r.RE_ACT || 0);
    const reLm  = Number(r.RE_LM || 0);
    const psAct = Number(r.PS_ACT || 0);
    const psLm  = Number(r.PS_LM || 0);

    const RE_to_IO = ioAct === 0 ? 0 : Number(((reAct / ioAct) * 100).toFixed(1));
    const RE_to_IO_LM = ioLm === 0 ? 0 : Number(((reLm / ioLm) * 100).toFixed(1));
    const RE_to_IO_PPT = Number((RE_to_IO - RE_to_IO_LM).toFixed(1));

    const PS_to_IO = ioAct === 0 ? 0 : Number(((psAct / ioAct) * 100).toFixed(1));
    const PS_to_IO_LM = ioLm === 0 ? 0 : Number(((psLm / ioLm) * 100).toFixed(1));
    const PS_to_IO_PPT = Number((PS_to_IO - PS_to_IO_LM).toFixed(1));

    const PS_to_RE = reAct === 0 ? 0 : Number(((psAct / reAct) * 100).toFixed(1));
    const PS_to_RE_LM = reLm === 0 ? 0 : Number(((psLm / reLm) * 100).toFixed(1));
    const PS_to_RE_PPT = Number((PS_to_RE - PS_to_RE_LM).toFixed(1));

    return {
      label: r.label,
      level: 'region',

      IO_ACT: ioAct,
      IO_LM: ioLm,
      IO_MoM: r.IO_MoM === null ? 0 : Number(r.IO_MoM),
      IO_DAILY: Math.round(ioAct / dayCount),

      RE_ACT: reAct,
      RE_LM: reLm,
      RE_MoM: r.RE_MoM === null ? 0 : Number(r.RE_MoM),
      RE_DAILY: Math.round(reAct / dayCount),

      PS_ACT: psAct,
      PS_LM: psLm,
      PS_MoM: r.PS_MoM === null ? 0 : Number(r.PS_MoM),
      PS_DAILY: Math.round(psAct / dayCount),

      RE_to_IO, RE_to_IO_LM, RE_to_IO_PPT,
      PS_to_IO, PS_to_IO_LM, PS_to_IO_PPT,
      PS_to_RE, PS_to_RE_LM, PS_to_RE_PPT
    };
  });

  // final stack: clusters, separator, branches, separator, region
  return [
    ...clustersFinal,
    ...blank1,
    ...branchesFinal,
    ...blank2,
    ...regionsFinal
  ];
}

module.exports = { getIOREPSData };
