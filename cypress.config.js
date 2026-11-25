const { defineConfig } = require("cypress");
const { readFileSync } = require("node:fs");
const { resolve, basename } = require("node:path");
const carpeta = process.env.CONTASYS_E2E_ARTEFACTOS;

module.exports = defineConfig({
    viewportWidth: 1366,
    viewportHeight: 900,
    video: false,
    trashAssetsBeforeRuns: false,
    ...(carpeta ? { screenshotsFolder: resolve(carpeta, "capturas"), downloadsFolder: resolve(carpeta, "descargas") } : {}),
    e2e: {
        supportFile: "cypress/support/e2e.js",
        setupNodeEvents(on, config) {
            on("task", {
                validarPdf({ archivo, textos }) {
                    const contenido = readFileSync(resolve(config.downloadsFolder, basename(archivo)), "latin1");
                    return contenido.startsWith("%PDF-") && contenido.trimEnd().endsWith("%%EOF") &&
                        textos.every(texto => contenido.includes(texto));
                },
                validarExcel(archivo) {
                    const XLSX = require("./vendor/sheetjs/xlsx.full.min.js");
                    const libro = XLSX.read(readFileSync(resolve(config.downloadsFolder, basename(archivo))), { type: "buffer" });
                    const detalle = XLSX.utils.sheet_to_json(libro.Sheets.Detalle);
                    const resumen = XLSX.utils.sheet_to_json(libro.Sheets.Resumen);
                    return { filas: detalle.length, ultimo: detalle.at(-1).Descripcion,
                        monto: detalle[0].Monto, conceptos: resumen.map(fila => fila.Concepto) };
                }
            });
            return config;
        }
    }
});
