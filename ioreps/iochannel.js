const { getIOChannelData } = require("./iochannelquery");
const { renderIOChannel: renderTable } = require("./iochanneltable");

async function renderIOChannel(selectedDate) {
    const rows = await getIOChannelData(selectedDate);

    const imgBuffer = await renderTable(rows);

    return imgBuffer;
}

module.exports = { renderIOChannel };
