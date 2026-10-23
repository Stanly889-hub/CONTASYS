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

    await renderizarTabla();
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