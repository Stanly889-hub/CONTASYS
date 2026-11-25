let sesionUsuario = exigirSesion();

async function iniciar() {
    if (!sesionUsuario) return;

    if (sesionUsuario.rol !== "Administrador") {
        mostrarNotificacion("No tienes permisos para ver esta página", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
        return;
    }

    iniciarMarcoOperacion(sesionUsuario, "usuarios");
    document.querySelector("[data-panel-administrador]").hidden = false;
    await Promise.all([cargarEstadisticas(), renderizarTabla()]);
}

async function cargarEstadisticas() {
    let est;
    try {
        est = await apiFetch("/usuarios/estadisticas");
    } catch (error) {
        return;
    }

    let contenedor = document.getElementById("estadisticasUsuarios");
    contenedor.innerHTML = "";

    [
        ["Usuarios", est.totalUsuarios, "grupo", `${est.usuariosActivos} activos`],
        ["Administradores", est.porRol.Administrador || 0, "ajustes"],
        ["Contadores", est.porRol.Contador || 0, "reporte"],
        ["Emprendedores", est.porRol.Emprendedor || 0, "persona"],
        ["Plan Premium", est.porPlan.Premium, "grafica"],
        ["Plan Free", est.porPlan.Free, "billetera"]
    ].forEach(([titulo, valor, icono, detalle]) => {
        let tarjeta = document.createElement("div");
        tarjeta.className = "kpi cs-card";
        let h = document.createElement("h3");
        h.textContent = titulo;
        let p = document.createElement("p");
        p.textContent = valor;
        const marca = document.createElement("span");
        marca.className = "cs-kpi-icon";
        marca.innerHTML = iconoOperacion(icono);
        const datos = document.createElement("div");
        datos.append(h, p);
        if (detalle) {
            const subtitulo = document.createElement("small");
            subtitulo.textContent = detalle;
            datos.append(subtitulo);
        }
        tarjeta.append(marca, datos);
        contenedor.appendChild(tarjeta);
    });
}

async function renderizarTabla() {
    estadoAdministracion("estadoListado", "Cargando usuarios…");
    let usuarios;
    try {
        usuarios = await apiFetch("/usuarios");
    } catch (error) {
        estadoAdministracion("estadoListado", error.message, true);
        mostrarNotificacion(error.message, "error");
        return;
    }
    estadoAdministracion("estadoListado", "");

    let tabla = document.getElementById("tablaUsuarios");
    tabla.innerHTML = "";
    if (!usuarios.length) vacioAdministracion(tabla, 8, "No hay usuarios registrados.");

    usuarios.forEach(u => {
        let fila = document.createElement("tr");

        fila.insertCell().append(personaAdministracion(u));
        fila.insertCell().textContent = u.documento;
        fila.insertCell().textContent = u.correo;
        fila.insertCell().append(etiquetaAdministracion(u.rol));
        fila.insertCell().append(etiquetaAdministracion(u.estado));
        fila.insertCell().textContent = fechaComunicacion(u.fechaRegistro);

        // Columna "Cambiar rol": lista desplegable (no se puede cambiar el rol propio).
        let celdaRol = document.createElement("td");
        if (u.idUsuario === sesionUsuario.idUsuario) {
            celdaRol.textContent = "—";
        } else {
            let selector = document.createElement("select");
            selector.setAttribute("aria-label", `Rol de ${u.nombre} ${u.apellido}`);
            ["Administrador", "Contador", "Emprendedor"].forEach(rol => {
                let opcion = document.createElement("option");
                opcion.value = rol;
                opcion.textContent = rol;
                opcion.selected = rol === u.rol;
                selector.appendChild(opcion);
            });
            selector.onchange = () => cambiarRol(u, selector.value);
            celdaRol.appendChild(selector);
        }
        fila.appendChild(celdaRol);

        let celdaAcciones = document.createElement("td");

        if (u.idUsuario === sesionUsuario.idUsuario) {
            celdaAcciones.textContent = "— (tu cuenta)";
        } else {
            let boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = u.estado === "Activo" ? "Desactivar" : "Activar";
            boton.className = "btn-accion cs-button cs-button-secondary " + (u.estado === "Activo" ? "btn-eliminar" : "btn-editar");
            boton.onclick = () => confirmarCambioEstado(u);
            celdaAcciones.appendChild(boton);
        }

        fila.appendChild(celdaAcciones);
        tabla.appendChild(fila);
    });
}

async function confirmarCambioEstado(usuario) {
    const desactivar = usuario.estado === "Activo";
    const accion = desactivar ? "Desactivar" : "Activar";
    const dialogo = document.getElementById("confirmacionOperacion");
    const titulo = document.getElementById("tituloConfirmacion");
    const icono = document.getElementById("iconoDesactivacion");
    const boton = dialogo.querySelector('[value="eliminar"]');
    const nombre = `${usuario.nombre} ${usuario.apellido}`;
    dialogo.toggleAttribute("data-desactivacion", desactivar);
    icono.hidden = !desactivar;
    titulo.textContent = `${accion} usuario`;
    boton.textContent = accion;
    let confirmado;
    try {
        confirmado = await confirmarEliminacion(desactivar
            ? `¿Desactivar la cuenta de ${nombre}? Perderá el acceso y sus sesiones se cerrarán.`
            : `¿Activar la cuenta de ${nombre}?`);
    } finally {
        dialogo.removeAttribute("data-desactivacion");
        icono.hidden = true;
        titulo.textContent = "Confirmar acción";
        boton.textContent = "Confirmar";
    }
    if (confirmado) await cambiarEstado(usuario.idUsuario, desactivar ? "Inactivo" : "Activo");
}

async function cambiarRol(usuario, nuevoRol) {
    if (!await confirmarEliminacion(`¿Cambiar el rol de ${usuario.nombre} ${usuario.apellido} a ${nuevoRol}?`)) {
        renderizarTabla();
        return;
    }

    try {
        await apiFetch(`/usuarios/${usuario.idUsuario}/rol`, {
            method: "PUT",
            body: JSON.stringify({ rol: nuevoRol })
        });
        mostrarNotificacion("Rol actualizado", "ok");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
    await cargarEstadisticas();
    renderizarTabla();
}

async function cambiarEstado(idUsuario, nuevoEstado) {
    try {
        await apiFetch(`/usuarios/${idUsuario}/estado`, {
            method: "PUT",
            body: JSON.stringify({ estado: nuevoEstado })
        });
        mostrarNotificacion(`Usuario ${nuevoEstado === "Activo" ? "activado" : "desactivado"}`, "ok");
        await Promise.all([cargarEstadisticas(), renderizarTabla()]);
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

iniciar();
