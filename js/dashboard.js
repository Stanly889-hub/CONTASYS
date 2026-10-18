let sesionUsuario = exigirSesion();

if (sesionUsuario) {
    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="dashboard"]').classList.add("active");
}

async function actualizarDashboard() {
    let datos;
    try {
        datos = await apiFetch("/dashboard");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    document.getElementById("ingresos").textContent = formatoCOP(datos.ingresos);
    document.getElementById("egresos").textContent = formatoCOP(datos.egresos);
    document.getElementById("balance").textContent = formatoCOP(datos.balance);

    let tabla = document.getElementById("tablaMovimientos");
    tabla.innerHTML = "";

    if (datos.recientes.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 5;
        celda.style.textAlign = "center";
        celda.textContent = "Aún no tienes movimientos registrados.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    datos.recientes.forEach(m => {
        let fila = document.createElement("tr");
        [m.fecha, m.tipo === "ingreso" ? "Ingreso" : "Egreso", m.categoria, formatoCOP(m.monto), m.descripcion]
            .forEach(valor => {
                let td = document.createElement("td");
                td.textContent = valor;
                fila.appendChild(td);
            });
        tabla.appendChild(fila);
    });
}

actualizarDashboard();