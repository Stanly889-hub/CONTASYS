const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

test("PDF y Excel toman el mismo reporte, conservan centavos y etiquetan estados", () => {
    const textos = [];
    const avisos = [];
    const hojas = new Map();
    const archivos = [];
    class PdfPrueba {
        setFontSize() {}
        text(texto) { textos.push(texto); }
        addImage() {}
        splitTextToSize(texto) { return [texto]; }
        save(nombre) { archivos.push(nombre); }
    }
    const contexto = vm.createContext({
        exigirSesion: () => null,
        window: { jspdf: { jsPDF: PdfPrueba } },
        avisar: mensaje => avisos.push(mensaje),
        XLSX: {
            utils: {
                book_new: () => ({}),
                json_to_sheet: filas => filas,
                book_append_sheet: (_libro, hoja, nombre) => hojas.set(nombre, hoja)
            },
            writeFile: (_libro, nombre) => archivos.push(nombre)
        },
        fixture: {
            desde: "2026-05-01",
            hasta: "2026-05-31",
            totales: { ingresos: "0.30", egresos: "0.40", balance: "-0.10" },
            pendientes: { ingresos: "1.25", egresos: "0.00" },
            detalle: [
                { fecha: "2026-05-01", tipo: "ingreso", monto: "0.30", categoria: "Ventas", estadoTransaccion: "Confirmada" },
                { fecha: "2026-05-02", tipo: "ingreso", monto: "1.25", categoria: "Ventas", estadoTransaccion: "Pendiente" },
                { fecha: "2026-05-03", tipo: "egreso", monto: "7.00", categoria: "Arriendo", estadoTransaccion: "Anulada" }
            ]
        }
    });
    for (const archivo of ["app.js", "reportes.js"]) {
        vm.runInContext(readFileSync(resolve(__dirname, "../../js", archivo), "utf8"), contexto);
    }
    vm.runInContext(`
        mostrarNotificacion = avisar;
        reporteActual = fixture;
        chartIngresosEgresos = chartCategorias = { toBase64Image: () => "" };
        exportarPDF();
        exportarExcel();
        planUsuario = "Premium";
        exportarExcel();
    `, contexto);
    assert.deepEqual(archivos, ["reporte_contasys_2026-05-01_a_2026-05-31.pdf", "reporte_contasys_2026-05-01_a_2026-05-31.xlsx"]);
    assert.match(avisos[0], /Premium/);
    assert.ok(textos.some(texto => /Balance confirmado:.*0,10/.test(texto) && texto.includes("-")));
    assert.ok(textos.some(texto => /Ingresos pendientes:.*1,25/.test(texto)));
    assert.ok(textos.some(texto => texto.includes("Anulada")));
    assert.equal(hojas.get("Resumen").find(fila => fila.Concepto === "Balance confirmado").Valor, -0.1);
    assert.equal(hojas.get("Resumen").find(fila => fila.Concepto === "Ingresos pendientes").Valor, 1.25);
    assert.deepEqual(Array.from(hojas.get("Detalle"), fila => fila.Estado), ["Confirmada", "Pendiente", "Anulada"]);
    assert.equal(hojas.get("Detalle")[0].Monto, 0.3);
    assert.equal(vm.runInContext('importeExcel("99999999999999.99")', contexto), "99999999999999.99");
    assert.match(vm.runInContext('formatoCOPExacto("9999999999999999.99")', contexto), /9\.999\.999\.999\.999\.999,99/);
});
