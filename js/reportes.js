// Lógica de la página de reportes (reportes.html)

let sesionUsuario = exigirSesion();
let reporteActual = null;
let planUsuario = "Free";
let chartIngresosEgresos = null;
let chartCategorias = null;
let peticionReporte;
const FILAS_REPORTE = 100;
let paginaDetalle = 0;

function primerDiaDelMes() {
    let d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

async function iniciar() {
    if (!sesionUsuario) return;

    iniciarMarcoOperacion(sesionUsuario, "reportes");

    document.getElementById("fechaDesde").value = primerDiaDelMes();
    document.getElementById("fechaHasta").value = fechaLocalISO();

    document.getElementById("detalleAnterior").onclick = () => mostrarDetalle(paginaDetalle - 1);
    document.getElementById("detalleSiguiente").onclick = () => mostrarDetalle(paginaDetalle + 1);
    await Promise.all([cargarPlan(), generarReporte()]);
}

async function cargarPlan() {
    // La exportación a Excel es una función del plan Premium.
    try {
        let s = await apiFetch("/suscripcion");
        planUsuario = s.beneficios.exportarExcel ? "Premium" : "Free";
    } catch (error) {
        planUsuario = "Free";
    }
    const etiqueta = document.getElementById("textoExportarExcel");
    etiqueta.textContent = planUsuario === "Premium" ? "Exportar Excel" : "Exportar Excel · Premium";
}

async function generarReporte() {
    let desde = document.getElementById("fechaDesde").value;
    let hasta = document.getElementById("fechaHasta").value;

    if (!desde || !hasta) {
        mostrarNotificacion("Selecciona ambas fechas", "error");
        return;
    }
    if (desde > hasta) {
        mostrarNotificacion("La fecha inicial no puede ser mayor que la final", "error");
        return;
    }

    peticionReporte?.abort();
    const peticion = new AbortController();
    peticionReporte = peticion;
    estadoListado("Cargando reporte…", "carga");
    try {
        const datos = await apiFetch(`/reportes?desde=${desde}&hasta=${hasta}`, { signal: peticion.signal });
        if (peticion.signal.aborted) return;
        reporteActual = datos;
    } catch (error) {
        if (!peticion.signal.aborted) {
            estadoListado(reporteActual ? "No se pudo actualizar el reporte. Se conserva el último periodo consultado." : "No se pudo cargar el reporte.", "error");
            mostrarNotificacion(error.message, "error");
        }
        return;
    }

    document.getElementById("resumenIngresos").textContent = formatoCOP(reporteActual.totales.ingresos);
    document.getElementById("resumenEgresos").textContent = formatoCOP(reporteActual.totales.egresos);
    document.getElementById("resumenBalance").textContent = formatoCOP(reporteActual.totales.balance);
    mostrarPendientesIndicadores(reporteActual.pendientes);
    marcarSignoIndicador("resumenBalance", reporteActual.totales.balance);

    document.getElementById("resultadosReportes").hidden = false;
    document.getElementById("navegarDetalleReporte").hidden = false;
    estadoListado("");
    renderizarGraficas(reporteActual.totales, reporteActual.gastosPorCategoria);
    mostrarDetalle(0);
}

function mostrarDetalle(pagina) {
    if (!reporteActual) return;
    const cantidad = reporteActual.detalle.length;
    const totalPaginas = Math.max(1, Math.ceil(cantidad / FILAS_REPORTE));
    if (pagina < 0 || pagina >= totalPaginas) return;
    paginaDetalle = pagina;
    const desde = pagina * FILAS_REPORTE;
    renderizarTablaDetalle(reporteActual.detalle.slice(desde, desde + FILAS_REPORTE));
    document.getElementById("detalleAnterior").disabled = pagina === 0;
    document.getElementById("detalleSiguiente").disabled = pagina + 1 >= totalPaginas;
    document.getElementById("estadoDetalleReporte").textContent = `Página ${pagina + 1} de ${totalPaginas} · ${cantidad} movimientos`;
}

function renderizarGraficas(totales, gastosCategoria) {
    chartIngresosEgresos?.destroy();
    chartCategorias?.destroy();
    const importes = [totales.ingresos, totales.egresos];
    const categorias = Object.entries(gastosCategoria);
    const hayMovimientos = importes.some(monto => centavosCOP(monto) !== 0n);
    const comparacion = prepararGraficaIndicadores("graficaIngresosEgresos", hayMovimientos);
    const distribucion = prepararGraficaIndicadores("graficaCategorias", categorias.length > 0);
    chartIngresosEgresos = hayMovimientos ? new Chart(comparacion, {
        type: "bar",
        data: { labels: ["Ingresos", "Egresos"], datasets: [{ data: importes, backgroundColor: ["#2563EB", "#D97706"], borderRadius: 8, maxBarThickness: 36 }] },
        options: { ...opcionesIndicadores(), indexAxis: "y", scales: { x: ejeIndicadores(), y: { grid: { display: false } } } }
    }) : null;
    chartCategorias = categorias.length ? new Chart(distribucion, {
        type: "doughnut",
        data: { labels: categorias.map(([nombre]) => nombre), datasets: [{ data: categorias.map(([, monto]) => monto), backgroundColor: coloresIndicadores }] },
        options: { ...opcionesIndicadores(true), cutout: "64%" }
    }) : null;
}

function renderizarTablaDetalle(detalle) {
    let tabla = document.getElementById("tablaDetalle");
    tabla.innerHTML = "";

    if (detalle.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 6;
        celda.className = "cs-table-empty";
        celda.textContent = "No hay movimientos en este periodo.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    detalle.forEach(m => {
        let fila = document.createElement("tr");

        let celdas = [
            m.fecha,
            m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
            m.categoria,
            m.metodoPago,
            m.descripcion,
            formatoCOP(m.monto)
        ];

        celdas.forEach((valor, i) => {
            let td = document.createElement("td");
            td.textContent = valor;
            if (i === 5) {
                const estado = document.createElement("small");
                estado.className = "ra-row-status";
                estado.dataset.estado = m.estadoTransaccion;
                estado.textContent = m.estadoTransaccion;
                td.append(estado);
            }
            fila.appendChild(td);
        });

        tabla.appendChild(fila);
    });
}

function exportarPDF() {
    if (!reporteActual || reporteActual.detalle.length === 0) {
        mostrarNotificacion("No hay datos para exportar en este periodo", "error");
        return;
    }

    const doc = crearPDFReporte(reporteActual, [chartIngresosEgresos, chartCategorias]);
    doc.save(`reporte_contasys_${reporteActual.desde}_a_${reporteActual.hasta}.pdf`);
}

function crearPDFReporte(reporte, graficas) {
    const doc = new window.jspdf.jsPDF();
    const marino = "#0F172A";
    const azul = "#2563EB";
    const suave = "#DBEAFE";
    const x = 14;
    const ancho = 182;
    const columnas = [["Fecha", 22], ["Tipo / estado", 25], ["Categoría", 24], ["Método", 22], ["Descripción", 53], ["Monto (COP)", 36]];
    let y;
    let pagina = 1;
    function estilo(tamano, color = marino, negrita = false) {
        doc.setFontSize(tamano);
        doc.setTextColor?.(color);
        doc.setFont?.("helvetica", negrita ? "bold" : "normal");
    }
    function fondo(color, izquierda, arriba, w, h) {
        doc.setFillColor?.(color);
        doc.rect?.(izquierda, arriba, w, h, "F");
    }
    function encabezado() {
        fondo(marino, 0, 0, 210, 32);
        const marcaDisponible = typeof agregarMarcaPDF === "function";
        if (marcaDisponible) agregarMarcaPDF(doc, x, 4, 24);
        estilo(15, "#FFFFFF", true);
        doc.text(marcaDisponible ? "Reporte financiero" : "CONTASYS · Reporte financiero", 69, 15);
        estilo(9, suave);
        doc.text(`Periodo: ${reporte.desde} a ${reporte.hasta}`, 69, 22);
        y = 40;
    }
    function pie() {
        fondo(suave, x, 281, ancho, .35);
        estilo(8, "#475569");
        doc.text("CONTASYS · Reporte financiero", x, 287);
        doc.text(`Página ${pagina}`, x + ancho, 287, { align: "right" });
    }
    function tabla() {
        estilo(10, azul, true);
        doc.text("Detalle de movimientos", x, y + 3);
        y += 7;
        fondo(suave, x, y, ancho, 8);
        estilo(8, marino, true);
        let izquierda = x;
        for (const [titulo, anchoColumna] of columnas) {
            doc.text(titulo, izquierda + 2, y + 5);
            izquierda += anchoColumna;
        }
        y += 8;
    }
    function nuevaPagina() {
        pie();
        doc.addPage();
        pagina++;
        encabezado();
        tabla();
    }

    encabezado();
    const { totales, pendientes } = reporte;
    const indicadores = [
        ["Ingresos confirmados", totales.ingresos], ["Egresos confirmados", totales.egresos],
        ["Balance confirmado", totales.balance], ["Ingresos pendientes", pendientes.ingresos], ["Egresos pendientes", pendientes.egresos]
    ];
    fondo("#F8FAFC", x, y, ancho, 35);
    indicadores.forEach(([etiqueta, monto], i) => {
        estilo(i === 2 ? 11 : 9, i === 2 ? azul : marino, i === 2);
        doc.text(`${etiqueta}: ${formatoCOPExacto(monto)}`, x + 4, y + 6 + i * 6);
    });
    y += 43;
    for (const [i, titulo] of ["Ingresos vs Egresos", "Gastos por categoría"].entries()) {
        const izquierda = x + i * 94;
        estilo(9, marino, true);
        doc.text(titulo, izquierda, y);
        const grafica = graficas[i];
        const imagen = grafica?.toBase64Image();
        if (imagen) {
            const proporcion = grafica.width / grafica.height || 1.5;
            const w = Math.min(87, 47 * proporcion);
            doc.addImage(imagen, "PNG", izquierda + (87 - w) / 2, y + 3, w, w / proporcion);
        } else {
            estilo(8, "#475569");
            doc.text("Sin datos para esta gráfica.", izquierda, y + 9);
        }
    }
    y += 56;
    tabla();
    for (const [indice, movimiento] of reporte.detalle.entries()) {
        estilo(8);
        const datos = [movimiento.fecha, `${movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso"}\n${movimiento.estadoTransaccion}`,
            movimiento.categoria, movimiento.metodoPago, movimiento.descripcion, formatoCOPExacto(movimiento.monto)];
        const celdas = datos.map((valor, i) => String(valor ?? "").split("\n")
            .flatMap(linea => doc.splitTextToSize(linea, columnas[i][1] - 4)));
        const lineas = Math.max(...celdas.map(celda => celda.length));
        const capacidad = () => Math.floor((274 - y - 4) / 4);
        if (lineas > capacidad()) nuevaPagina();
        for (let inicio = 0; inicio < lineas;) {
            const cantidad = Math.min(lineas - inicio, capacidad());
            const alto = cantidad * 4 + 4;
            if (indice % 2 === 0) fondo("#F8FAFC", x, y, ancho, alto);
            estilo(8);
            let izquierda = x;
            celdas.forEach((celda, i) => {
                const derecha = i === columnas.length - 1;
                const w = columnas[i][1];
                celda.slice(inicio, inicio + cantidad).forEach((linea, j) =>
                    doc.text(linea, izquierda + (derecha ? w - 2 : 2), y + 4.5 + j * 4, { align: derecha ? "right" : "left" }));
                izquierda += w;
            });
            y += alto;
            inicio += cantidad;
            if (inicio < lineas) nuevaPagina();
        }
    }
    pie();
    return doc;
}

function importeExcel(monto) {
    const centavos = centavosCOP(monto);
    // Excel conserva hasta 15 dígitos significativos en una celda numérica.
    return centavos >= -999999999999999n && centavos <= 999999999999999n ? Number(monto) : monto;
}

function exportarExcel() {
    if (planUsuario !== "Premium") {
        mostrarNotificacion("La exportación a Excel es una función del plan Premium. Puedes contratarlo en Mi cuenta", "error");
        return;
    }

    if (!reporteActual || reporteActual.detalle.length === 0) {
        mostrarNotificacion("No hay datos para exportar en este periodo", "error");
        return;
    }

    let resumen = [
        { Concepto: "Periodo", Valor: `${reporteActual.desde} a ${reporteActual.hasta}` },
        { Concepto: "Ingresos confirmados", Valor: importeExcel(reporteActual.totales.ingresos) },
        { Concepto: "Egresos confirmados", Valor: importeExcel(reporteActual.totales.egresos) },
        { Concepto: "Balance confirmado", Valor: importeExcel(reporteActual.totales.balance) },
        { Concepto: "Ingresos pendientes", Valor: importeExcel(reporteActual.pendientes.ingresos) },
        { Concepto: "Egresos pendientes", Valor: importeExcel(reporteActual.pendientes.egresos) }
    ];

    let detalle = reporteActual.detalle.map(m => ({
        Fecha: m.fecha,
        Tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
        Estado: m.estadoTransaccion,
        Categoria: m.categoria,
        MetodoPago: m.metodoPago,
        Descripcion: m.descripcion,
        Monto: importeExcel(m.monto)
    }));

    let wb = XLSX.utils.book_new();
    const hojaResumen = XLSX.utils.json_to_sheet(resumen);
    const hojaDetalle = XLSX.utils.json_to_sheet(detalle);
    hojaResumen["!cols"] = [{ wch: 27 }, { wch: 36 }];
    hojaDetalle["!cols"] = [13, 13, 16, 26, 24, 50, 26].map(wch => ({ wch }));
    hojaDetalle["!autofilter"] = { ref: hojaDetalle["!ref"] ?? `A1:G${detalle.length + 1}` };
    const moneda = '"COP "$#,##0.00;-"COP "$#,##0.00';
    for (const [hoja, columna, filas] of [[hojaResumen, "B", resumen], [hojaDetalle, "G", detalle]]) {
        filas.forEach((_, i) => {
            const celda = hoja[`${columna}${i + 2}`];
            if (celda?.t === "n") celda.z = moneda;
        });
    }
    XLSX.utils.book_append_sheet(wb, hojaResumen, "Resumen");
    XLSX.utils.book_append_sheet(wb, hojaDetalle, "Detalle");

    XLSX.writeFile(wb, `reporte_contasys_${reporteActual.desde}_a_${reporteActual.hasta}.xlsx`);
}

iniciar();
