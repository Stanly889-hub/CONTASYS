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

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="reportes"]').classList.add("active");

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
    let botonExcel = document.querySelector('[onclick="exportarExcel()"]');
    if (botonExcel && planUsuario !== "Premium") botonExcel.textContent = "Exportar Excel 🔒 Premium";
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
    const estado = document.getElementById("estadoDetalleReporte");
    document.getElementById("navegarDetalleReporte").hidden = false;
    estado.textContent = "Cargando reporte…";
    try {
        const datos = await apiFetch(`/reportes?desde=${desde}&hasta=${hasta}`, { signal: peticion.signal });
        if (peticion.signal.aborted) return;
        reporteActual = datos;
    } catch (error) {
        if (!peticion.signal.aborted) {
            estado.textContent = "No se pudo actualizar el reporte";
            mostrarNotificacion(error.message, "error");
        }
        return;
    }

    document.getElementById("resumenIngresos").textContent = formatoCOP(reporteActual.totales.ingresos);
    document.getElementById("resumenEgresos").textContent = formatoCOP(reporteActual.totales.egresos);
    document.getElementById("resumenBalance").textContent = formatoCOP(reporteActual.totales.balance);
    document.getElementById("resumenPendientes").textContent = textoPendientes(reporteActual.pendientes);

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
    let ctx1 = document.getElementById("graficaIngresosEgresos").getContext("2d");
    if (chartIngresosEgresos) chartIngresosEgresos.destroy();
    chartIngresosEgresos = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Egresos'],
            datasets: [{
                label: 'Monto',
                data: [totales.ingresos, totales.egresos],
                backgroundColor: ['#00c9a7', '#ff4d4d']
            }]
        },
        options: {
            responsive: true,
            animation: false,
            plugins: { legend: { display: false } },
            scales: { y: { ticks: { callback: (v) => formatoCOP(v) } } }
        }
    });

    let ctx2 = document.getElementById("graficaCategorias").getContext("2d");
    if (chartCategorias) chartCategorias.destroy();

    let categorias = Object.keys(gastosCategoria);
    let valores = Object.values(gastosCategoria);

    chartCategorias = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: categorias.length ? categorias : ['Sin egresos en el periodo'],
            datasets: [{
                data: valores.length ? valores.map(Number) : [0],
                backgroundColor: ['#1e3a5f', '#2c5364', '#00c9a7', '#ff4d4d', '#f4b400', '#8e44ad', '#16a085']
            }]
        },
        options: { responsive: true, animation: false }
    });
}

function renderizarTablaDetalle(detalle) {
    let tabla = document.getElementById("tablaDetalle");
    tabla.innerHTML = "";

    if (detalle.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 6;
        celda.style.textAlign = "center";
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
            `${formatoCOP(m.monto)} · ${m.estadoTransaccion}`
        ];

        celdas.forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
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

    const { jsPDF } = window.jspdf;
    let doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("CONTASYS - Reporte financiero", 14, 18);

    doc.setFontSize(11);
    doc.text(`Periodo: ${reporteActual.desde} a ${reporteActual.hasta}`, 14, 26);
    const { totales, pendientes } = reporteActual;
    doc.text(`Ingresos confirmados: ${formatoCOPExacto(totales.ingresos)}`, 14, 34);
    doc.text(`Egresos confirmados: ${formatoCOPExacto(totales.egresos)}`, 14, 40);
    doc.text(`Balance confirmado: ${formatoCOPExacto(totales.balance)}`, 14, 46);
    doc.text(`Ingresos pendientes: ${formatoCOPExacto(pendientes.ingresos)}`, 14, 53);
    doc.text(`Egresos pendientes: ${formatoCOPExacto(pendientes.egresos)}`, 14, 59);

    let y = 69;
    doc.text("Ingresos vs Egresos", 14, y);
    doc.text("Gastos por categoría", 110, y);
    doc.addImage(chartIngresosEgresos.toBase64Image(), "PNG", 14, y + 4, 85, 60);
    doc.addImage(chartCategorias.toBase64Image(), "PNG", 110, y + 4, 85, 60);

    y += 75;
    doc.setFontSize(12);
    doc.text("Detalle de movimientos", 14, y);
    y += 8;

    doc.setFontSize(9);
    reporteActual.detalle.forEach(m => {
        const linea = `${m.fecha}  ${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}  ${m.estadoTransaccion}  ${m.categoria}  ${formatoCOPExacto(m.monto)}  ${m.descripcion || ""}`;
        for (const parte of doc.splitTextToSize(linea, 180)) {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(parte, 14, y);
            y += 6;
        }
    });

    doc.save(`reporte_contasys_${reporteActual.desde}_a_${reporteActual.hasta}.pdf`);
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), "Detalle");

    XLSX.writeFile(wb, `reporte_contasys_${reporteActual.desde}_a_${reporteActual.hasta}.xlsx`);
}

iniciar();
