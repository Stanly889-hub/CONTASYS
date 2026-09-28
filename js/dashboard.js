// Lógica de la página del dashboard (dashboard.html)

function actualizarDashboard() {
    let movimientos = obtenerMovimientos();

    let ingresos = 0;
    let egresos = 0;

    let tabla = document.getElementById("tablaMovimientos");
    tabla.innerHTML = "";

    movimientos.forEach(m => {
        if (m.tipo === "ingreso") ingresos += m.monto;
        else egresos += m.monto;

        let fila = document.createElement("tr");

        let celdaFecha = document.createElement("td");
        celdaFecha.textContent = m.fecha;

        let celdaTipo = document.createElement("td");
        celdaTipo.textContent = m.tipo;

        let celdaMonto = document.createElement("td");
        celdaMonto.textContent = "$" + m.monto;

        let celdaDesc = document.createElement("td");
        celdaDesc.textContent = m.descripcion;

        fila.append(celdaFecha, celdaTipo, celdaMonto, celdaDesc);
        tabla.appendChild(fila);
    });

    document.getElementById("ingresos").textContent = "$" + ingresos;
    document.getElementById("egresos").textContent = "$" + egresos;
    document.getElementById("balance").textContent = "$" + (ingresos - egresos);
}

function agregarIngreso() {
    let monto = document.getElementById("monto").value;
    let desc = document.getElementById("desc").value;

    if (!monto || !desc) {
        mostrarNotificacion("Completa los campos", "error");
        return;
    }

    guardarMovimiento("ingreso", monto, desc);
    document.getElementById("monto").value = "";
    document.getElementById("desc").value = "";
    actualizarDashboard();
}

function agregarEgreso() {
    let monto = document.getElementById("monto").value;
    let desc = document.getElementById("desc").value;

    if (!monto || !desc) {
        mostrarNotificacion("Completa los campos", "error");
        return;
    }

    guardarMovimiento("egreso", monto, desc);
    document.getElementById("monto").value = "";
    document.getElementById("desc").value = "";
    actualizarDashboard();
}

actualizarDashboard();