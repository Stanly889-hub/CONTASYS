let sesionUsuario = exigirSesion();
let chartTendencia = null;

async function iniciar() {
    if (!sesionUsuario) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="analisis"]').classList.add("active");

    let datos;
    try {
        datos = await apiFetch("/analisis");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    // Plan Free: el análisis solo cubre los últimos meses.
    let aviso = document.getElementById("avisoPlan");
    if (datos.limitado) {
        aviso.textContent = `Plan Free: este análisis incluye solo los últimos ${datos.mesesIncluidos} meses. Con Premium verás tu historial completo.`;
        aviso.style.display = "block";
    } else {
        aviso.style.display = "none";
    }

    document.getElementById("totalIngresos").textContent = formatoCOP(datos.totales.ingresos);
    document.getElementById("totalEgresos").textContent = formatoCOP(datos.totales.egresos);
    document.getElementById("totalBalance").textContent = formatoCOP(datos.totales.balance);
    document.getElementById("tasaAhorro").textContent = datos.totales.tasaAhorro + "%";
    document.getElementById("resumenPendientes").textContent = textoPendientes(datos.pendientes);

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
    let ctx = document.getElementById("graficaTendencia").getContext("2d");
    if (chartTendencia) chartTendencia.destroy();

    if (tendencia.length === 0) {
        tendencia = [{ mes: "Sin datos", ingresos: 0, egresos: 0 }];
    }

    chartTendencia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: tendencia.map(t => etiquetaMes(t.mes)),
            datasets: [
                {
                    label: 'Ingresos',
                    data: tendencia.map(t => t.ingresos),
                    backgroundColor: '#00c9a7',
                    borderRadius: 6,
                    maxBarThickness: 60
                },
                {
                    label: 'Egresos',
                    data: tendencia.map(t => t.egresos),
                    backgroundColor: '#ff4d4d',
                    borderRadius: 6,
                    maxBarThickness: 60
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (c) => `${c.dataset.label}: ${formatoCOP(c.raw)}`
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { callback: (v) => formatoCOP(v) } }
            }
        }
    });
}

function renderizarTopCategorias(categorias) {
    let tabla = document.getElementById("tablaTopCategorias");
    tabla.innerHTML = "";

    if (categorias.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 2;
        celda.style.textAlign = "center";
        celda.textContent = "Aún no tienes egresos registrados.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

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
