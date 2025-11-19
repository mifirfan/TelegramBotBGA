const path = require("path");
const { createExcelImage } = require("../excelImage");

async function renderPSProduct() {
    return await createExcelImage(
        path.join(__dirname, "../sourcedata/Report_PS_2025x.xlsx"),
        "channel",
        "B9:AT54",
        "psproduct.png"
    );
}

module.exports = { renderPSProduct };
