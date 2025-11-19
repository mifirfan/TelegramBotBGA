const path = require("path");
const { createExcelImage } = require("../excelImage");

async function renderREChannel() {
    return await createExcelImage(
        path.join(__dirname, "../sourcedata/Report_RE_2025x.xlsx"),
        "channel",
        "B9:AQ56",
        "rechannel.png"
    );
}

module.exports = { renderREChannel };
