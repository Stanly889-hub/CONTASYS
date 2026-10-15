// Lógica de la página de reportes (reportes.html)

let sesionActual = exigirSesion();
let reporteActual = null;
let chartIngresosEgresos = null;
let chartCategorias = null;

function primerDiaDelMes() {
    let d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function hoyISO() {
    return new Date().toISOString().slice(0, 10);
}

function iniciar() {
    if (!sesionActual) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionActual.nombre} (${sesionActual.rol})`;
    aplicarPermisosPorRol(sesionActual.rol);
    document.querySelector('[data-page="reportes"]').classList.add("active");

    document.getElementById("fechaDesde").value = primerDiaDelMes();
    document.getElementById("fechaHasta").value = hoyISO();

    generarReporte();
}

function generarReporte() {
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

    let detalle = filtrarMovimientosPorPeriodo(desde, hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
    let totales = totalesPorTipo(detalle);
    let gastosCategoria = gastosPorCategoria(detalle);

    reporteActual = { desde, hasta, detalle, totales, gastosCategoria };

    document.getElementById("resumenIngresos").textContent = formatoCOP(totales.ingresos);
    document.getElementById("resumenEgresos").textContent = formatoCOP(totales.egresos);
    document.getElementById("resumenBalance").textContent = formatoCOP(totales.balance);

    renderizarGraficas(totales, gastosCategoria);
    renderizarTablaDetalle(detalle);
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
                data: valores.length ? valores : [1],
                backgroundColor: ['#1e3a5f', '#2c5364', '#00c9a7', '#ff4d4d', '#f4b400', '#8e44ad', '#16a085']
            }]
        },
        options: { responsive: true }
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
            formatoCOP(m.monto)
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
    doc.text(`Total Ingresos: ${formatoCOP(reporteActual.totales.ingresos)}`, 14, 34);
    doc.text(`Total Egresos: ${formatoCOP(reporteActual.totales.egresos)}`, 14, 40);
    doc.text(`Balance: ${formatoCOP(reporteActual.totales.balance)}`, 14, 46);

    let y = 56;
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
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
        let linea = `${m.fecha}  ${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}  ${m.categoria}  ${formatoCOP(m.monto)}  ${m.descripcion}`;
        doc.text(linea, 14, y);
        y += 6;
    });

    doc.save(`reporte_contasys_${reporteActual.desde}_a_${reporteActual.hasta}.pdf`);
}

function exportarExcel() {
    if (!reporteActual || reporteActual.detalle.length === 0) {
        mostrarNotificacion("No hay datos para exportar en este periodo", "error");
        return;
    }

    let resumen = [
        { Concepto: "Periodo", Valor: `${reporteActual.desde} a ${reporteActual.hasta}` },
        { Concepto: "Total Ingresos", Valor: reporteActual.totales.ingresos },
        { Concepto: "Total Egresos", Valor: reporteActual.totales.egresos },
        { Concepto: "Balance", Valor: reporteActual.totales.balance }
    ];

    let detalle = reporteActual.detalle.map(m => ({
        Fecha: m.fecha,
        Tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
        Categoria: m.categoria,
        MetodoPago: m.metodoPago,
        Descripcion: m.descripcion,
        Monto: m.monto
    }));

    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), "Detalle");

    XLSX.writeFile(wb, `reporte_contasys_${reporteActual.desde}_a_${reporteActual.hasta}.xlsx`);
}

iniciar();