const { getIOREPSData } = require("./iorepsquery");
const { renderIOREPS: renderTable } = require("./iorepstable");

async function renderIOREPS(selectedDate) {
    const rows = await getIOREPSData(selectedDate);

    const imgBuffer = await renderTable(rows);

    return imgBuffer;
}

module.exports = { renderIOREPS };
