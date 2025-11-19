const { exec } = require("child_process");
const path = require("path");

function createExcelImage(excelFile, sheet, range, outputName) {
    return new Promise((resolve, reject) => {

        const pythonScript = path.join(__dirname, "render_excel.py");
        const outputPath = path.join(__dirname, "output", outputName);

        const command = `python "${pythonScript}" --file "${excelFile}" --sheet "${sheet}" --range "${range}" --out "${outputPath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("Render Error:", stderr);
                return reject(error);
            }
            resolve(outputPath);
        });

    });
}

module.exports = { createExcelImage };