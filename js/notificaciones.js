let sesionUsuario = exigirSesion();
const navegarNotificaciones = crearPaginador(document.getElementById("listaNotificaciones"), cargarPaginaNotificaciones);

async function iniciar() {
    if (!sesionUsuario) return;

    iniciarMarcoOperacion(sesionUsuario, "notificaciones");

    await renderizarLista();
}

async function renderizarLista() {
    return navegarNotificaciones("/notificaciones");
}

async function cargarPaginaNotificaciones(ruta, signal) {
    estadoListado("Cargando notificaciones…", "carga");
    let datos;
    try {
        datos = await apiFetch(ruta, { signal });
    } catch (error) {
        if (!signal.aborted) estadoListado(error.message, "error");
        throw error;
    }
    if (signal.aborted) return;
    estadoListado("");
    const { registros: notificaciones, siguiente } = datos;
    let contenedor = document.getElementById("listaNotificaciones");
    contenedor.innerHTML = "";

    if (notificaciones.length === 0) {
        contenedor.innerHTML = "<p class='sin-notificaciones'>No tienes notificaciones.</p>";
        return siguiente;
    }

    notificaciones.forEach(n => {
        let tarjeta = document.createElement("div");
        tarjeta.className = "notif-tarjeta" + (n.estado === "Pendiente" ? " no-leida" : "");
        const tipo = tipoNotificacion(n.mensaje);
        tarjeta.dataset.tono = tipo.tono;
        const icono = document.createElement("span");
        icono.className = "cs-kpi-icon";
        icono.innerHTML = iconoOperacion(tipo.icono);

        const contenido = document.createElement("div");
        contenido.className = "com-notif-contenido";
        const encabezado = document.createElement("div");
        encabezado.className = "com-notif-meta";
        const titulo = document.createElement("strong");
        titulo.textContent = tipo.titulo;
        const lectura = document.createElement("span");
        lectura.className = "cs-pill com-lectura";
        lectura.textContent = n.estado === "Pendiente" ? "Sin leer" : "Leída";
        encabezado.append(titulo, lectura);

        let texto = document.createElement("p");
        texto.textContent = n.mensaje;

        let fecha = document.createElement("span");
        fecha.className = "notif-fecha";
        fecha.textContent = fechaComunicacion(n.fecha);

        let acciones = document.createElement("div");
        acciones.className = "notif-acciones cs-module-actions cs-row-actions";

        if (tipo.solicitud && sesionUsuario.rol === "Emprendedor") {
            const enlace = document.createElement("a");
            enlace.href = "cuenta.html#seccionContadores";
            enlace.textContent = "Revisar solicitud";
            acciones.append(enlace);
        }

        if (n.estado === "Pendiente") {
            let btnVista = document.createElement("button");
            btnVista.textContent = "Marcar como vista";
            btnVista.className = "btn-accion btn-editar cs-button cs-button-secondary";
            btnVista.onclick = async () => {
                await actualizarNotificacion(n.idNotificacion, "vista");
            };
            acciones.appendChild(btnVista);
        }

        let btnArchivar = document.createElement("button");
        btnArchivar.textContent = "Archivar";
        btnArchivar.className = "btn-accion btn-eliminar cs-button cs-button-secondary";
        btnArchivar.onclick = async () => {
            await actualizarNotificacion(n.idNotificacion, "archivar");
        };
        acciones.appendChild(btnArchivar);

        contenido.append(encabezado, texto, fecha, acciones);
        tarjeta.append(icono, contenido);
        contenedor.appendChild(tarjeta);
    });
    return siguiente;
}

function tipoNotificacion(mensaje) {
    if (mensaje.startsWith("El presupuesto «")) {
        const tono = mensaje.endsWith(" superó su límite de egresos")
            ? "error" : mensaje.endsWith(" alcanzó su meta de ingresos") ? "exito" : "aviso";
        return { titulo: "Alerta presupuestaria", icono: "billetera", tono };
    }
    if (mensaje.endsWith("solicita ver tus finanzas en modo solo lectura. Respóndele en Mi cuenta.")) {
        return { titulo: "Solicitud de vinculación", icono: "grupo", tono: "neutro", solicitud: true };
    }
    if (mensaje.endsWith(" tu solicitud de acceso a sus finanzas.")) {
        return { titulo: "Respuesta a vinculación", icono: "grupo", tono: mensaje.endsWith(" aceptó tu solicitud de acceso a sus finanzas.") ? "exito" : "aviso" };
    }
    return { titulo: "Aviso de cuenta", icono: "campana", tono: "neutro" };
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
