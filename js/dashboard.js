// Lógica de la página del dashboard (dashboard.html)

let sesionActual = exigirSesion();

if (sesionActual) {
    document.getElementById("nombreUsuarioActual").textContent =
        `${sesionActual.nombre} (${sesionActual.rol})`;
    aplicarPermisosPorRol(sesionActual.rol);
    document.querySelector('[data-page="dashboard"]').classList.add("active");
}

function actualizarDashboard() {
    let movimientos = obtenerMovimientos();

    let ingresos = movimientos.filter(m => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
    let egresos = movimientos.filter(m => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0);

    document.getElementById("ingresos").textContent = formatoCOP(ingresos);
    document.getElementById("egresos").textContent = formatoCOP(egresos);
    document.getElementById("balance").textContent = formatoCOP(ingresos - egresos);

    let recientes = [...movimientos]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 5);

    let tabla = document.getElementById("tablaMovimientos");
    tabla.innerHTML = "";

    if (recientes.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 5;
        celda.textContent = "Aún no tienes movimientos registrados.";
        celda.style.textAlign = "center";
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    recientes.forEach(m => {
        let fila = document.createElement("tr");

        let celdaFecha = document.createElement("td");
        celdaFecha.textContent = m.fecha;

        let celdaTipo = document.createElement("td");
        celdaTipo.textContent = m.tipo === "ingreso" ? "Ingreso" : "Egreso";

        let celdaCategoria = document.createElement("td");
        celdaCategoria.textContent = m.categoria;

        let celdaMonto = document.createElement("td");
        celdaMonto.textContent = formatoCOP(m.monto);

        let celdaDesc = document.createElement("td");
        celdaDesc.textContent = m.descripcion;

        fila.append(celdaFecha, celdaTipo, celdaCategoria, celdaMonto, celdaDesc);
        tabla.appendChild(fila);
    });
}

actualizarDashboard();