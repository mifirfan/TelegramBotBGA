const path = require("path");
const { createExcelImage } = require("../excelImage");

async function renderMarketshare() {
    return await createExcelImage(
        path.join(__dirname, "../sourcedata/New_Market_Share_Household_Eastern.xlsx"),
        "Meta Market Share City &Kec New",
        "D4:BE26",
        "marketshare.png"
    );
}

module.exports = { renderMarketshare };
