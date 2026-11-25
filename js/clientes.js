let sesionUsuario = exigirSesion();
let solicitandoCliente = false;

async function iniciar() {
    if (!sesionUsuario) return;

    if (sesionUsuario.rol !== "Contador") {
        mostrarNotificacion("No tienes permisos para ver esta página", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
        return;
    }

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="clientes"]').classList.add("active");

    mostrarClienteActivo();
    await cargarLimite();
    await renderizarTabla();
}

function mostrarClienteActivo() {
    let cliente = obtenerClienteActivo();
    let info = document.getElementById("infoClienteActivo");
    if (!cliente) {
        info.style.display = "none";
        return;
    }
    info.style.display = "block";
    info.textContent = `Ahora estás viendo los datos de ${cliente.nombre} ${cliente.apellido || ""}. `;
    let boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn-accion btn-editar";
    boton.textContent = "Volver a mis datos";
    boton.onclick = () => { localStorage.removeItem("clienteActivo"); mostrarClienteActivo(); };
    info.appendChild(boton);
}

async function cargarLimite() {
    let nota = document.getElementById("notaLimiteClientes");
    try {
        let s = await apiFetch("/suscripcion");
        nota.textContent = s.planEfectivo === "Premium"
            ? "Plan Premium: puedes tener clientes ilimitados."
            : `Plan Free: puedes tener hasta ${s.limitesFree.clientes} clientes (cuentan las solicitudes pendientes). Con Premium no hay límite.`;
    } catch (error) {
        nota.textContent = "";
    }
}

document.getElementById("formCliente").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (solicitandoCliente) return;
    let correo = document.getElementById("correoCliente").value.trim();
    if (!correo) {
        mostrarNotificacion("Indica el correo del cliente", "error");
        return;
    }
    solicitandoCliente = true;
    if (e.submitter) e.submitter.disabled = true;
    try {
        await apiFetch("/vinculos", { method: "POST", body: JSON.stringify({ correoCliente: correo }) });
        mostrarNotificacion("Solicitud enviada", "ok");
        this.reset();
        await cargarLimite();
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    } finally {
        solicitandoCliente = false;
        if (e.submitter) e.submitter.disabled = false;
    }
});

async function renderizarTabla() {
    let clientes;
    try {
        clientes = await apiFetch("/vinculos?como=contador");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    let tabla = document.getElementById("tablaClientes");
    tabla.innerHTML = "";

    if (clientes.length === 0) {
        let fila = document.createElement("tr");
        let td = document.createElement("td");
        td.colSpan = 4;
        td.textContent = "Aún no tienes clientes. Solicita acceso con el correo de un cliente.";
        fila.appendChild(td);
        tabla.appendChild(fila);
        return;
    }

    clientes.forEach(c => {
        let fila = document.createElement("tr");

        let estadoTexto = c.estado === "Aceptado" ? (c.estadoOtro === "Activo" ? "Acceso autorizado" : "Cuenta inactiva")
            : c.estado === "Pendiente" ? "Pendiente de respuesta"
            : c.estado === "Suspendido" ? "Suspendido. Requiere una nueva solicitud"
            : "Rechazado";

        [`${c.nombre} ${c.apellido}`, c.correo, estadoTexto].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });

        let celdaAcciones = document.createElement("td");

        if (c.estado === "Aceptado" && c.estadoOtro === "Activo") {
            let btnVer = document.createElement("button");
            btnVer.textContent = "Ver datos";
            btnVer.className = "btn-accion btn-editar";
            btnVer.onclick = () => {
                establecerClienteActivo({ idUsuario: c.idOtro, nombre: c.nombre, apellido: c.apellido });
                window.location.href = "dashboard.html";
            };
            celdaAcciones.appendChild(btnVer);
        }

        let btnQuitar = document.createElement("button");
        btnQuitar.textContent = "Quitar";
        btnQuitar.className = "btn-accion btn-eliminar";
        btnQuitar.onclick = () => quitarCliente(c);
        celdaAcciones.appendChild(btnQuitar);

        fila.appendChild(celdaAcciones);
        tabla.appendChild(fila);
    });
}

async function quitarCliente(c) {
    if (!confirm(`¿Quitar a ${c.nombre} ${c.apellido} de tus clientes? Perderás el acceso a sus datos.`)) return;

    try {
        await apiFetch(`/vinculos/${c.idVinculo}`, { method: "DELETE" });
        let activo = obtenerClienteActivo();
        if (activo && activo.idUsuario === c.idOtro) localStorage.removeItem("clienteActivo");
        mostrarNotificacion("Vínculo eliminado", "ok");
        mostrarClienteActivo();
        await cargarLimite();
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

iniciar();
