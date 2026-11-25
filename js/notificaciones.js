let sesionUsuario = exigirSesion();
const navegarNotificaciones = crearPaginador(document.getElementById("listaNotificaciones"), cargarPaginaNotificaciones);

async function iniciar() {
    if (!sesionUsuario) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="notificaciones"]').classList.add("active");

    await renderizarLista();
}

async function renderizarLista() {
    return navegarNotificaciones("/notificaciones");
}

async function cargarPaginaNotificaciones(ruta, signal) {
    const { registros: notificaciones, siguiente } = await apiFetch(ruta, { signal });
    if (signal.aborted) return;
    let contenedor = document.getElementById("listaNotificaciones");
    contenedor.innerHTML = "";

    if (notificaciones.length === 0) {
        contenedor.innerHTML = "<p class='sin-notificaciones'>No tienes notificaciones.</p>";
        return siguiente;
    }

    notificaciones.forEach(n => {
        let tarjeta = document.createElement("div");
        tarjeta.className = "notif-tarjeta" + (n.estado === "Pendiente" ? " no-leida" : "");

        let texto = document.createElement("p");
        texto.textContent = n.mensaje;

        let fecha = document.createElement("span");
        fecha.className = "notif-fecha";
        fecha.textContent = n.fecha;

        let acciones = document.createElement("div");
        acciones.className = "notif-acciones";

        if (n.estado === "Pendiente") {
            let btnVista = document.createElement("button");
            btnVista.textContent = "Marcar como vista";
            btnVista.className = "btn-accion btn-editar";
            btnVista.onclick = async () => {
                await actualizarNotificacion(n.idNotificacion, "vista");
            };
            acciones.appendChild(btnVista);
        }

        let btnArchivar = document.createElement("button");
        btnArchivar.textContent = "Archivar";
        btnArchivar.className = "btn-accion btn-eliminar";
        btnArchivar.onclick = async () => {
            await actualizarNotificacion(n.idNotificacion, "archivar");
        };
        acciones.appendChild(btnArchivar);

        tarjeta.append(texto, fecha, acciones);
        contenedor.appendChild(tarjeta);
    });
    return siguiente;
}

async function actualizarNotificacion(id, accion) {
    try {
        await apiFetch(`/notificaciones/${id}/${accion}`, { method: "PUT" });
        await renderizarLista();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

iniciar();
