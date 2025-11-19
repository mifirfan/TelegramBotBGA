const path = require("path");
const { createExcelImage } = require("../excelImage");

async function renderPSChannel() {
    return await createExcelImage(
        path.join(__dirname, "../sourcedata/Report_PS_2025x.xlsx"),
        "channel",
        "B9:AQ56",
        "pschannel.png"
    );
}

module.exports = { renderPSChannel };
