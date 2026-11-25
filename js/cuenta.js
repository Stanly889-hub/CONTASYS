let sesionUsuario = exigirSesion();
let cambiandoPlan = false;
const navegarActividad = crearPaginador(document.getElementById("tablaActividad").closest(".cs-table-scroll"), cargarPaginaActividad, 10);

async function iniciar() {
    if (!sesionUsuario) return;

    iniciarMarcoOperacion(sesionUsuario, "cuenta");

    document.getElementById("datosNombre").textContent = `${sesionUsuario.nombre} ${sesionUsuario.apellido || ""}`;
    document.getElementById("avatarPerfil").prepend(avatarComunicacion(sesionUsuario.nombre, sesionUsuario.apellido));
    document.getElementById("datosCorreo").textContent = sesionUsuario.correo;
    document.getElementById("datosRol").textContent = sesionUsuario.rol;

    await cargarSuscripcion();
    await cargarAccesos();
    if (window.location.hash === "#seccionContadores" && sesionUsuario.rol === "Emprendedor") {
        document.getElementById("seccionContadores").scrollIntoView({ block: "start" });
    }
    await cargarActividad();
}

async function cargarSuscripcion() {
    try {
        let s = await apiFetch("/suscripcion");

        // planEfectivo: un Premium vencido se trata como Free.
        let esPremium = s.planEfectivo === "Premium";
        let premiumVencido = s.tipoPlan === "Premium" && !esPremium;

        document.getElementById("planActual").textContent = esPremium
            ? "Premium"
            : (premiumVencido ? "Free (Premium sin vigencia)" : "Free (gratuito)");
        const simulacion = document.getElementById("estadoSimulacionPlan");
        simulacion.textContent = s.pagoSimuladoDisponible ? "Simulación habilitada" : "Simulación no disponible";
        simulacion.dataset.habilitada = String(Boolean(s.pagoSimuladoDisponible));
        simulacion.hidden = false;

        document.getElementById("tarjetaFree").classList.toggle("plan-activo", !esPremium);
        document.getElementById("tarjetaPremium").classList.toggle("plan-activo", esPremium);

        let boton = document.getElementById("btnCambiarPlan");
        boton.textContent = esPremium ? "Cancelar Premium (volver a Free)" :
            (s.pagoSimuladoDisponible ? "Simular Premium ($19.900 COP/mes)" : "Contratación no disponible");
        boton.disabled = !esPremium && !s.pagoSimuladoDisponible;
        boton.onclick = () => cambiarPlan(esPremium ? "Free" : "Premium");
        const renovar = document.getElementById("btnRenovarPremium");
        renovar.hidden = !esPremium || !s.pagoSimuladoDisponible;
        renovar.onclick = () => cambiarPlan("Premium", true);
    } catch (error) {
        document.getElementById("planActual").textContent = "Sin suscripción";
        document.getElementById("btnCambiarPlan").textContent = "Cambio de plan no disponible";
    }
}

async function cargarAccesos() {
    // Solo los Emprendedores pueden recibir solicitudes de un contador.
    let seccion = document.getElementById("seccionContadores");
    if (sesionUsuario.rol !== "Emprendedor") {
        seccion.style.display = "none";
        return;
    }
    seccion.style.display = "block";

    let accesos;
    estadoAdministracion("estadoAccesos", "Cargando accesos…");
    try {
        accesos = await apiFetch("/vinculos?como=cliente");
    } catch (error) {
        estadoAdministracion("estadoAccesos", error.status === 500
            ? "No se pudieron cargar las solicitudes. Pide al administrador que compruebe la compatibilidad del esquema de vinculaciones."
            : error.message, true);
        return;
    }
    estadoAdministracion("estadoAccesos", "");

    let tabla = document.getElementById("tablaContadores");
    tabla.innerHTML = "";

    if (accesos.length === 0) {
        let fila = document.createElement("tr");
        let td = document.createElement("td");
        td.colSpan = 4;
        td.textContent = "Ningún contador ha solicitado acceso a tus finanzas.";
        fila.appendChild(td);
        tabla.appendChild(fila);
        return;
    }

    accesos.forEach(a => {
        let fila = document.createElement("tr");
        let estadoTexto = a.estado === "Aceptado" ? "Acceso autorizado"
            : a.estado === "Pendiente" ? "Pendiente de tu respuesta"
            : a.estado === "Suspendido" ? "Suspendido. Requiere tu autorización"
            : "Rechazado";

        fila.insertCell().append(personaAdministracion(a));
        fila.insertCell().textContent = a.correo;
        const estado = fila.insertCell();
        estado.append(etiquetaAdministracion(estadoTexto, a.estado));
        if (a.estado === "Aceptado") {
            const permiso = document.createElement("small");
            permiso.className = "adm-permiso";
            permiso.textContent = a.facturasAutorizadas ? "Lectura de facturas autorizada" : "Facturas sin acceso";
            estado.append(permiso);
        }

        let celdaAcciones = document.createElement("td");
        const acciones = document.createElement("div");
        acciones.className = "cs-module-actions cs-row-actions";
        const boton = (texto, clase, accion) => {
            let b = document.createElement("button");
            b.type = "button";
            b.textContent = texto;
            b.className = "btn-accion cs-button " + (texto === "Aceptar" ? "cs-button-primary " : "cs-button-secondary ") + clase;
            b.onclick = accion;
            acciones.appendChild(b);
        };

        if (a.estado === "Pendiente") {
            boton("Aceptar", "btn-editar", () => responderSolicitud(a, true));
            boton("Rechazar", "btn-eliminar", () => responderSolicitud(a, false));
        } else if (a.estado === "Aceptado") {
            boton(a.facturasAutorizadas ? "Revocar acceso a facturas" : "Autorizar lectura de facturas",
                "btn-editar", () => cambiarPermisoFacturas(a));
            boton("Revocar acceso", "btn-eliminar", () => revocarAcceso(a));
        } else {
            boton("Quitar", "btn-eliminar", () => revocarAcceso(a, true));
        }

        celdaAcciones.append(acciones);
        fila.appendChild(celdaAcciones);
        tabla.appendChild(fila);
    });
}

async function cambiarPermisoFacturas(vinculo) {
    const autorizar = !vinculo.facturasAutorizadas;
    if (!confirm(autorizar ? "¿Permitir a este contador consultar y descargar tus facturas emitidas?" :
        "¿Revocar el acceso de este contador a tus facturas?")) return;
    try {
        await apiFetch(`/vinculos/${vinculo.idVinculo}/facturas`, {
            method: "PUT", body: JSON.stringify({ autorizar })
        });
        mostrarNotificacion(autorizar ? "Lectura de facturas autorizada" : "Permiso de facturas revocado", "ok");
        await cargarAccesos();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

async function responderSolicitud(a, aceptar) {
    try {
        await apiFetch(`/vinculos/${a.idVinculo}/responder`, { method: "PUT", body: JSON.stringify({ aceptar }) });
        mostrarNotificacion(aceptar ? "Solicitud aceptada" : "Solicitud rechazada", "ok");
        cargarAccesos();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

async function revocarAcceso(a, soloQuitar = false) {
    if (!soloQuitar && !await confirmarEliminacion(`¿Revocar el acceso de ${a.nombre} ${a.apellido} a tus finanzas?`)) return;

    try {
        await apiFetch(`/vinculos/${a.idVinculo}`, { method: "DELETE" });
        mostrarNotificacion("Vínculo eliminado", "ok");
        cargarAccesos();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

async function cambiarPlan(nuevoPlan, renovar = false) {
    if (cambiandoPlan) return;
    let mensaje = nuevoPlan === "Premium"
        ? `¿Confirmas ${renovar ? "la renovación" : "la contratación"} simulada de Premium por $19.900 COP al mes? No se realizará ningún cobro.`
        : "Vas a cancelar tu plan Premium y volver al plan gratuito Free. ¿Confirmas?";

    if (!await confirmarEliminacion(mensaje)) return;

    cambiandoPlan = true;
    try {
        await apiFetch("/suscripcion", { method: "PUT", body: JSON.stringify({ tipoPlan: nuevoPlan }) });
        mostrarNotificacion(nuevoPlan === "Premium" ? "Premium actualizado (pago simulado)" : "Volviste al plan Free", "ok");
        await cargarSuscripcion();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    } finally {
        cambiandoPlan = false;
    }
}

async function cargarActividad() {
    return navegarActividad("/historial");
}

async function cargarPaginaActividad(ruta, signal) {
    const { registros: actividad, siguiente } = await apiFetch(ruta, { signal });
    if (signal.aborted) return;
    let tabla = document.getElementById("tablaActividad");
    tabla.innerHTML = "";
    if (!actividad.length) vacioAdministracion(tabla, 3, "Aún no hay actividad registrada.");

    actividad.forEach(a => {
        let fila = document.createElement("tr");
        [a.fecha, a.accion, a.modulo].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });
        tabla.appendChild(fila);
    });
    return siguiente;
}

iniciar();
