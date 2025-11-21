// ioreps/odpquery.js
const pool = require("../database");

function haversine(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// clean numeric fields
function parseNum(x) {
    if (!x) return 0;
    const n = Number(String(x).replace(/[%\s,]/g, ""));
    return isNaN(n) ? 0 : n;
}

async function getODPData(lat, lon) {
    const sql = `
        SELECT 
            noss_id,
            odp_index,
            odp_name,
            latitude,
            longitude,
            clusname,
            clusterstatus,
            avai,
            used,
            rsv,
            is_total,
            witel,
            sto,
            occ,
            newstat
        FROM fmc_mirror.sifa_odp
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
    `;

    const rows = await pool.query(sql);

    const list = rows.map(r => {
        const distance = haversine(
            Number(r.latitude),
            Number(r.longitude),
            lat, lon
        );

        return {
            ...r,
            avai: parseNum(r.avai),
            used: parseNum(r.used),
            rsv: parseNum(r.rsv),
            is_total: parseNum(r.is_total),
            occ: parseNum(r.occ),
            distance
        };
    });

    list.sort((a,b) => a.distance - b.distance);

    const top = list.slice(0, 20);

    top.forEach((r, i) => {
        r.rank = i + 1;
        r.occ_pct = Number(r.occ).toFixed(1);
    });

    return top;
}

module.exports = { getODPData };
