let sesionUsuario = exigirSesion();

const botonMenu = document.querySelector(".cs-menu-toggle");
const pantallaCompacta = window.matchMedia("(max-width: 900px)");

function mostrarMenu(abierto) {
    document.body.toggleAttribute("data-menu-abierto", abierto);
    botonMenu.setAttribute("aria-expanded", String(abierto));
}

botonMenu.addEventListener("click", evento => {
    const abierto = botonMenu.getAttribute("aria-expanded") !== "true";
    mostrarMenu(abierto);
    if (abierto && evento.detail === 0) document.querySelector("#menuFinanciero a").focus();
});
pantallaCompacta.addEventListener("change", () => mostrarMenu(false));
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && botonMenu.getAttribute("aria-expanded") === "true") {
        mostrarMenu(false);
        botonMenu.focus();
    }
});

if (sesionUsuario) {
    document.getElementById("nombreUsuarioActual").textContent = sesionUsuario.nombre;
    document.getElementById("rolUsuarioActual").textContent = sesionUsuario.rol;
    document.getElementById("grupoGestion").hidden = !["Contador", "Administrador"].includes(sesionUsuario.rol);
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="dashboard"]').classList.add("active");
}

function dibujarComparacion(datos) {
    const montos = [datos.ingresos, datos.egresos];
    if (montos.every(monto => centavosCOP(monto) === 0n)) {
        document.getElementById("comparacionVacia").hidden = false;
        return;
    }

    const lienzo = document.getElementById("graficaComparacion");
    lienzo.setAttribute("aria-label", `Movimientos confirmados. Ingresos: ${formatoCOP(datos.ingresos)}. Egresos: ${formatoCOP(datos.egresos)}.`);
    document.getElementById("marcoComparacion").hidden = false;
    const compacto = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
    new Chart(lienzo, {
        type: "bar",
        data: {
            labels: ["Ingresos", "Egresos"],
            datasets: [{
                data: montos.map(Number),
                backgroundColor: ["#2563EB", "#F59E0B"],
                borderRadius: 7,
                borderSkipped: false,
                maxBarThickness: 24
            }]
        },
        options: {
            indexAxis: "y",
            maintainAspectRatio: false,
            animation: matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 380 },
            scales: {
                x: { beginAtZero: true, grid: { color: "#E2E8F0" }, ticks: { maxTicksLimit: 5, color: "#475569", callback: valor => compacto.format(valor) } },
                y: { grid: { display: false }, border: { display: false }, ticks: { color: "#475569" } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: item => formatoCOPExacto(montos[item.dataIndex]) } }
            }
        }
    });
}

async function actualizarDashboard() {
    const estado = document.getElementById("estadoDashboard");
    let datos;
    try {
        datos = await apiFetch("/dashboard");
    } catch (error) {
        estado.classList.add("cs-status-error");
        estado.textContent = "No se pudo cargar el resumen financiero.";
        mostrarNotificacion(error.message, "error");
        return;
    }

    document.getElementById("ingresos").textContent = formatoCOP(datos.ingresos);
    document.getElementById("egresos").textContent = formatoCOP(datos.egresos);
    document.getElementById("balance").textContent = formatoCOP(datos.balance);
    document.getElementById("resumenPendientes").textContent = textoPendientes(datos.pendientes);
    document.getElementById("ingresosPendientes").textContent = formatoCOP(datos.pendientes.ingresos);
    document.getElementById("egresosPendientes").textContent = formatoCOP(datos.pendientes.egresos);
    estado.hidden = true;
    document.getElementById("datosDashboard").hidden = false;
    dibujarComparacion(datos);

    let tabla = document.getElementById("tablaMovimientos");
    tabla.innerHTML = "";

    if (datos.recientes.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 5;
        celda.className = "cs-table-empty";
        const plantilla = document.getElementById("movimientosVacios");
        celda.appendChild(plantilla.content.cloneNode(true));
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    datos.recientes.forEach(m => {
        let fila = document.createElement("tr");
        const esIngreso = m.tipo === "ingreso";
        [m.fecha, esIngreso ? "Ingreso" : "Egreso", formatoCOP(m.monto), m.categoria, m.descripcion]
            .forEach((valor, indice) => {
                let td = document.createElement("td");
                if (indice === 1) {
                    const etiqueta = document.createElement("span");
                    etiqueta.className = esIngreso ? "cs-pill cs-pill-ingreso" : "cs-pill cs-pill-egreso";
                    etiqueta.textContent = valor;
                    td.appendChild(etiqueta);
                } else if (indice === 2) {
                    const monto = document.createElement("strong");
                    monto.textContent = valor;
                    const estado = document.createElement("small");
                    estado.className = "cs-movement-state";
                    estado.dataset.estado = m.estadoTransaccion;
                    estado.textContent = m.estadoTransaccion;
                    td.append(monto, estado);
                } else {
                    td.textContent = valor;
                }
                fila.appendChild(td);
            });
        tabla.appendChild(fila);
    });
}

if (sesionUsuario) {
    actualizarDashboard();
}
