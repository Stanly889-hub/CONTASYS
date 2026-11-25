const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const { setTimeout: pausa } = require("node:timers/promises");
const vm = require("node:vm");

const leer = archivo => readFileSync(resolve(__dirname, "../..", archivo), "utf8");
const factura = {
    numero: "FAC-00000007", fecha: "2026-05-30", estado: "Pagada",
    emisorNombre: "Emisor histórico", emisorDocumento: "123", emisorCorreo: "archivo@example.invalid",
    receptorNombre: "Receptor histórico", receptorDocumento: "456",
    subtotal: "10.27", descuento: "1.01", impuesto: "1.72", total: "10.98",
    detalle: [{ concepto: "Servicio", cantidad: "1.005", precioUnitario: "10.00", porcentajeDescuento: "10.00",
        porcentajeImpuesto: "19.00", descuento: "1.01", impuesto: "1.72", total: "10.76" }]
};

test("el PDF de factura utiliza los datos y totales recuperados", () => {
    const textos = [];
    const archivos = [];
    class PdfPrueba {
        setFontSize() {}
        text(texto) { textos.push(texto); }
        splitTextToSize(texto) { return [texto]; }
        save(nombre) { archivos.push(nombre); }
    }
    const contexto = vm.createContext({ window: { jspdf: { jsPDF: PdfPrueba } }, factura });
    for (const archivo of ["js/app.js", "js/facturaPdf.js"]) vm.runInContext(leer(archivo), contexto);
    vm.runInContext("descargarFacturaPDF(factura); descargarFacturaPDF(factura);", contexto);
    assert.deepEqual(archivos, ["FAC-00000007.pdf", "FAC-00000007.pdf"]);
    assert.ok(textos.some(linea => linea.includes("Documento comercial interno o de demostración")));
    assert.ok(textos.some(linea => linea.includes(factura.emisorNombre) && linea.includes(factura.emisorCorreo)));
    assert.ok(textos.some(linea => linea.includes(factura.receptorNombre)));
    assert.ok(textos.some(linea => linea.startsWith("Total:") && linea.includes("10,98")));
});

test("adaptación móvil de facturación en Chromium", {
    skip: !process.env.CONTASYS_NAVEGADOR
}, () => {
    const carpeta = mkdtempSync(resolve(tmpdir(), "contasys-facturas-"));
    const ruta = resolve(carpeta, "prueba.html");
    const simulacion = `
        const exigirSesion = () => ({ nombre: "Prueba", rol: "Emprendedor" });
        const obtenerClienteActivo = () => null;
        const aplicarPermisosPorRol = () => {};
        const apiFetch = async () => ({ facturas: [], resumen: {
            facturado: "0.00", pagado: "0.00", pendiente: "0.00", cantidad: 0
        } });
    `;
    const demo = leer("facturacion.html")
        .replace(/<link[^>]+>/g, "")
        .replace(/<script[^>]*><\/script>/g, "")
        .replace("</head>", "<style>" + leer("css/styles.css") + "</style></head>")
        .replace("</body>", `<script>${simulacion}\n${leer("js/app.js")}\n${leer("js/facturacion.js")}</script></body>`);
    const iframe = JSON.stringify(demo).replace(/</g, "\\u003c");
    writeFileSync(ruta, `<!doctype html><meta charset="UTF-8"><iframe width="375" height="812"></iframe>
        <pre id="resultado"></pre><script>
        const marco = document.querySelector("iframe");
        marco.onload = () => {
            const d = marco.contentDocument;
            const w = marco.contentWindow;
            d.getElementById("agregarConcepto").click();
            document.getElementById("resultado").textContent = JSON.stringify({
                ancho: w.innerWidth, scroll: d.documentElement.scrollWidth,
                filas: d.getElementById("conceptosFactura").children.length,
                tablaContenida: getComputedStyle(d.querySelector(".factura-tabla")).overflowX === "auto"
            });
        };
        marco.srcdoc = ${iframe};
        </script>`, "utf8");
    const navegador = spawnSync(process.env.CONTASYS_NAVEGADOR, [
        "--headless", "--disable-gpu", "--in-process-gpu", "--disable-background-networking", "--no-first-run",
        `--user-data-dir=${resolve(carpeta, "perfil")}`, "--dump-dom", pathToFileURL(ruta).href
    ], { encoding: "utf8", timeout: 30000, windowsHide: true });
    assert.ifError(navegador.error);
    assert.equal(navegador.status, 0, navegador.stderr?.slice(-600));
    const datos = JSON.parse(navegador.stdout.match(/<pre id="resultado">([^<]+)<\/pre>/)?.[1] ?? "{}");
    assert.equal(datos.ancho, 375);
    assert.ok(datos.scroll <= 376, `Ancho contenido: ${datos.scroll}`);
    assert.equal(datos.filas, 1);
    assert.equal(datos.tablaContenida, true);
});

test("Chromium descarga un PDF binario de factura con jsPDF real", {
    skip: !process.env.CONTASYS_NAVEGADOR,
    timeout: 30000
}, async t => {
    const documento = process.env.CONTASYS_FACTURA_CORREGIDA
        ? JSON.parse(readFileSync(process.env.CONTASYS_FACTURA_CORREGIDA, "utf8")) : factura;
    if (process.env.CONTASYS_FACTURA_CORREGIDA) {
        assert.equal(documento.estado, "Pendiente");
        assert.ok(documento.historialPagos.some(pago => pago.corregidoEn));
    }
    const carpeta = mkdtempSync(resolve(tmpdir(), "contasys-pdf-real-"));
    const descargas = resolve(carpeta, "descargas");
    const perfil = resolve(carpeta, "perfil");
    mkdirSync(descargas);
    writeFileSync(resolve(carpeta, "jspdf.js"),
        readFileSync(process.env.CONTASYS_JSPDF || resolve(__dirname, "../../vendor/jspdf/jspdf.umd.min.js")));
    const pagina = resolve(carpeta, "pdf.html");
    writeFileSync(pagina, `<!doctype html><meta charset="UTF-8"><script src="jspdf.js"></script>
        <button onclick="descargarFacturaPDF(datos)">Descargar PDF</button>
        <pre id="resultado"></pre>
        <script>${leer("js/app.js")}\n${leer("js/facturaPdf.js")}
        const datos = ${JSON.stringify(documento)};
        </script>`, "utf8");
    const navegador = spawn(process.env.CONTASYS_NAVEGADOR, [
        "--headless", "--disable-gpu", "--in-process-gpu", "--disable-background-networking", "--no-first-run",
        `--user-data-dir=${perfil}`, "--remote-debugging-port=0", "about:blank"
    ], { stdio: "ignore", windowsHide: true });
    t.after(() => navegador.kill());
    const puerto = resolve(perfil, "DevToolsActivePort");
    async function esperar(predicado, mensaje) {
        for (let i = 0; i < 100; i++) {
            const resultado = await predicado();
            if (resultado) return resultado;
            await pausa(100);
        }
        assert.fail(mensaje);
    }
    await esperar(() => existsSync(puerto), "Chromium no inició la sesión de prueba");
    const [numeroPuerto, destino] = readFileSync(puerto, "utf8").trim().split(/\r?\n/);
    const socket = new WebSocket(`ws://127.0.0.1:${numeroPuerto}${destino}`);
    t.after(() => socket.close());
    await new Promise((resolver, rechazar) => {
        socket.addEventListener("open", resolver, { once: true });
        socket.addEventListener("error", rechazar, { once: true });
    });
    let id = 0;
    const pendientes = new Map();
    socket.addEventListener("message", evento => {
        const mensaje = JSON.parse(evento.data);
        pendientes.get(mensaje.id)?.(mensaje);
        pendientes.delete(mensaje.id);
    });
    function enviar(method, params = {}, sessionId) {
        return new Promise((resolver, rechazar) => {
            const numero = ++id;
            pendientes.set(numero, ({ error, result }) => error ? rechazar(new Error(error.message)) : resolver(result));
            socket.send(JSON.stringify({ id: numero, method, params, sessionId }));
        });
    }
    await enviar("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: descargas });
    const { targetInfos } = await enviar("Target.getTargets");
    const { sessionId } = await enviar("Target.attachToTarget", {
        targetId: targetInfos.find(info => info.type === "page").targetId, flatten: true
    });
    await enviar("Page.navigate", { url: pathToFileURL(pagina).href }, sessionId);
    await esperar(async () => {
        const { result } = await enviar("Runtime.evaluate", {
            expression: "document.readyState === 'complete' && typeof datos !== 'undefined' && window.jspdf?.jsPDF.version"
        }, sessionId);
        return result.value === "4.2.1";
    }, "La página no cargó jsPDF 4.2.1");
    for (const type of ["mousePressed", "mouseReleased"]) {
        await enviar("Input.dispatchMouseEvent", { type, x: 20, y: 15, button: "left", clickCount: 1 }, sessionId);
    }
    const rutaPdf = resolve(descargas, `${documento.numero}.pdf`);
    await esperar(() => existsSync(rutaPdf), "Chromium no guardó el PDF");
    const pdf = readFileSync(rutaPdf, "latin1");
    assert.match(pdf, /^%PDF-/);
    for (const texto of [documento.numero, documento.emisorNombre, documento.receptorNombre,
        documento.total.replace(".", ","), `Estado: ${documento.estado}`, "Documento comercial interno"]) {
        assert.ok(pdf.includes(texto), texto);
    }
    if (documento.estado === "Pendiente") assert.ok(!pdf.includes("Estado: Pagada"));
    assert.match(pdf.trimEnd(), /%%EOF$/);
});
