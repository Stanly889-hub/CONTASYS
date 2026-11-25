let sesionUsuario = exigirSesion();
let solicitandoCliente = false;

async function iniciar() {
    if (!sesionUsuario) return;

    if (sesionUsuario.rol !== "Contador") {
        mostrarNotificacion("No tienes permisos para ver esta página", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
        return;
    }

    iniciarMarcoOperacion(sesionUsuario, "clientes");
    document.querySelector(".com-clientes").hidden = false;

    mostrarClienteActivo();
    await Promise.all([cargarLimite(), renderizarTabla()]);
}

function mostrarClienteActivo() {
    let cliente = obtenerClienteActivo();
    let info = document.getElementById("infoClienteActivo");
    info.hidden = !cliente;
    if (!cliente) {
        return;
    }
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
    nota.hidden = !nota.textContent;
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
    estadoListado("Cargando clientes…", "carga");
    let clientes;
    try {
        clientes = await apiFetch("/vinculos?como=contador");
    } catch (error) {
        estadoListado(error.message, "error");
        mostrarNotificacion(error.message, "error");
        return;
    }
    estadoListado("");

    let tabla = document.getElementById("tablaClientes");
    tabla.innerHTML = "";

    if (clientes.length === 0) {
        let fila = document.createElement("tr");
        let td = document.createElement("td");
        td.colSpan = 4;
        td.className = "cs-table-empty";
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

        const nombre = fila.insertCell();
        const perfil = document.createElement("div");
        perfil.className = "com-persona";
        perfil.append(avatarComunicacion(c.nombre, c.apellido), `${c.nombre} ${c.apellido}`);
        nombre.append(perfil);
        fila.insertCell().textContent = c.correo;
        const estado = document.createElement("span");
        estado.className = "cs-pill com-vinculo-estado";
        estado.dataset.estado = c.estado === "Aceptado" && c.estadoOtro !== "Activo" ? "Inactivo" : c.estado;
        estado.textContent = estadoTexto;
        fila.insertCell().append(estado);

        let celdaAcciones = document.createElement("td");
        const acciones = document.createElement("div");
        acciones.className = "cs-module-actions cs-row-actions";

        if (c.estado === "Aceptado" && c.estadoOtro === "Activo") {
            let btnVer = document.createElement("button");
            btnVer.textContent = "Ver datos";
            btnVer.className = "btn-accion btn-editar cs-button cs-button-secondary";
            btnVer.onclick = () => {
                establecerClienteActivo({ idUsuario: c.idOtro, nombre: c.nombre, apellido: c.apellido });
                window.location.href = "dashboard.html";
            };
            acciones.append(btnVer);
        }

        let btnQuitar = document.createElement("button");
        btnQuitar.textContent = "Quitar";
        btnQuitar.className = "btn-accion btn-eliminar cs-button cs-button-secondary";
        btnQuitar.onclick = () => quitarCliente(c);
        acciones.append(btnQuitar);
        celdaAcciones.append(acciones);

        fila.appendChild(celdaAcciones);
        tabla.appendChild(fila);
    });
}

async function quitarCliente(c) {
    if (!await confirmarEliminacion(`¿Quitar a ${c.nombre} ${c.apellido} de tus clientes? Perderás el acceso a sus datos.`)) return;

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
