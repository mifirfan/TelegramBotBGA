const { exec } = require("child_process");
const path = require("path");

function renderRsmHourly() {
    return new Promise((resolve, reject) => {

        const excelFile = path.join(__dirname, "../sourcedata/Hourly_AO_IOREPIPS_Nov.xlsx");
        const outputFile = path.join(__dirname, "../output/rsmhourly.png");

        const pythonScript = path.join(__dirname, "../render_excel.py");

        const command = `python "${pythonScript}" --file "${excelFile}" --sheet rsm --range B3:R46 --out "${outputFile}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("Render Error:", stderr);
                return reject(error);
            }
            return resolve(outputFile);
        });
    });
}

module.exports = { renderRsmHourly };
