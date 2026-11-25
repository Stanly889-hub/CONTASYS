let sesionUsuario = exigirSesion();
let chartTendencia = null;

async function iniciar() {
    if (!sesionUsuario) return;

    iniciarMarcoOperacion(sesionUsuario, "analisis");

    let datos;
    try {
        datos = await apiFetch("/analisis");
    } catch (error) {
        estadoListado("No se pudo cargar el análisis financiero.", "error");
        mostrarNotificacion(error.message, "error");
        return;
    }

    // Plan Free: el análisis solo cubre los últimos meses.
    document.getElementById("avisoPlan").hidden = !datos.limitado;
    if (datos.limitado) document.getElementById("detallePlanAnalisis").textContent =
        `Plan Free: últimos ${datos.mesesIncluidos} meses. Premium permite consultar el historial completo.`;
    document.getElementById("nombrePlanAnalisis").textContent = datos.plan;
    const fecha = valor => valor.split("-").reverse().join("/");
    document.getElementById("periodoAnalisis").textContent = datos.desde
        ? `${fecha(datos.desde)} a ${fecha(datos.hasta)}`
        : `Historial disponible hasta el ${fecha(datos.hasta)}`;

    document.getElementById("totalIngresos").textContent = formatoCOP(datos.totales.ingresos);
    document.getElementById("totalEgresos").textContent = formatoCOP(datos.totales.egresos);
    document.getElementById("totalBalance").textContent = formatoCOP(datos.totales.balance);
    document.getElementById("tasaAhorro").textContent = datos.totales.tasaAhorro + "%";
    mostrarPendientesIndicadores(datos.pendientes);
    marcarSignoIndicador("totalBalance", datos.totales.balance);
    marcarSignoIndicador("tasaAhorro", datos.totales.tasaAhorro);

    document.getElementById("resultadosAnalisis").hidden = false;
    estadoListado("");
    renderizarTendencia(datos.tendenciaMensual);
    renderizarTopCategorias(datos.topCategorias);
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaMes(mes) {
    let partes = mes.split("-");
    if (partes.length !== 2) return mes;
    return MESES[Number(partes[1]) - 1] + " " + partes[0];
}

function renderizarTendencia(tendencia) {
    const lienzo = prepararGraficaIndicadores("graficaTendencia", tendencia.length > 0);
    if (chartTendencia) chartTendencia.destroy();
    if (!tendencia.length) return;
    chartTendencia = new Chart(lienzo, {
        type: "line",
        data: {
            labels: tendencia.map(t => etiquetaMes(t.mes)),
            datasets: [
                {
                    label: 'Ingresos',
                    data: tendencia.map(t => t.ingresos),
                    borderColor: "#2563EB",
                    backgroundColor: "#2563EB",
                    tension: .24
                },
                {
                    label: 'Egresos',
                    data: tendencia.map(t => t.egresos),
                    borderColor: "#D97706",
                    backgroundColor: "#D97706",
                    tension: .24
                }
            ]
        },
        options: {
            ...opcionesIndicadores(true),
            interaction: { mode: "index", intersect: false },
            scales: {
                x: { grid: { display: false } },
                y: ejeIndicadores()
            }
        }
    });
}

function renderizarTopCategorias(categorias) {
    let tabla = document.getElementById("tablaTopCategorias");
    tabla.innerHTML = "";
    const lienzo = prepararGraficaIndicadores("graficaTopCategorias", categorias.length > 0);

    if (categorias.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 2;
        celda.className = "cs-table-empty";
        celda.textContent = "Aún no tienes egresos registrados.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    new Chart(lienzo, {
        type: "bar",
        data: { labels: categorias.map(c => c.categoria), datasets: [{ data: categorias.map(c => c.total), backgroundColor: coloresIndicadores, borderRadius: 7, maxBarThickness: 23 }] },
        options: {
            ...opcionesIndicadores(), indexAxis: "y",
            scales: { x: ejeIndicadores(), y: { grid: { display: false }, ticks: { callback(valor) {
                const nombre = this.getLabelForValue(valor);
                return nombre.length > 16 ? nombre.slice(0, 15) + "…" : nombre;
            } } } }
        }
    });
    categorias.forEach(c => {
        let fila = document.createElement("tr");
        [c.categoria, formatoCOP(c.total)].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });
        tabla.appendChild(fila);
    });
}

iniciar();
