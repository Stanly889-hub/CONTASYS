let sesionUsuario = exigirSesion();

async function iniciar() {
    if (!sesionUsuario) return;

    if (sesionUsuario.rol !== "Administrador") {
        mostrarNotificacion("No tienes permisos para ver esta página", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
        return;
    }

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="usuarios"]').classList.add("active");

    await cargarEstadisticas();
    await renderizarTabla();
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
        ["Usuarios", `${est.totalUsuarios} (${est.usuariosActivos} activos)`],
        ["Administradores", est.porRol.Administrador || 0],
        ["Contadores", est.porRol.Contador || 0],
        ["Emprendedores", est.porRol.Emprendedor || 0],
        ["Plan Premium", est.porPlan.Premium],
        ["Plan Free", est.porPlan.Free]
    ].forEach(([titulo, valor]) => {
        let tarjeta = document.createElement("div");
        tarjeta.className = "kpi";
        let h = document.createElement("h3");
        h.textContent = titulo;
        let p = document.createElement("p");
        p.textContent = valor;
        tarjeta.append(h, p);
        contenedor.appendChild(tarjeta);
    });
}

async function renderizarTabla() {
    let usuarios;
    try {
        usuarios = await apiFetch("/usuarios");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    let tabla = document.getElementById("tablaUsuarios");
    tabla.innerHTML = "";

    usuarios.forEach(u => {
        let fila = document.createElement("tr");

        [`${u.nombre} ${u.apellido}`, u.documento, u.correo, u.rol, u.estado, u.fechaRegistro].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });

        // Columna "Cambiar rol": lista desplegable (no se puede cambiar el rol propio).
        let celdaRol = document.createElement("td");
        if (u.idUsuario === sesionUsuario.idUsuario) {
            celdaRol.textContent = "—";
        } else {
            let selector = document.createElement("select");
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
            boton.textContent = u.estado === "Activo" ? "Desactivar" : "Activar";
            boton.className = "btn-accion " + (u.estado === "Activo" ? "btn-eliminar" : "btn-editar");
            boton.onclick = () => cambiarEstado(u.idUsuario, u.estado === "Activo" ? "Inactivo" : "Activo");
            celdaAcciones.appendChild(boton);
        }

        fila.appendChild(celdaAcciones);
        tabla.appendChild(fila);
    });
}

async function cambiarRol(usuario, nuevoRol) {
    if (!confirm(`¿Cambiar el rol de ${usuario.nombre} ${usuario.apellido} a ${nuevoRol}?`)) {
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
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

iniciar();