// Ya no se genera hash en el navegador: el backend lo hace con bcrypt (Sección 6).

function obtenerSesion() {
    return JSON.parse(localStorage.getItem("sesion"));
}

function exigirSesion() {
    let sesion = obtenerSesion();
    if (!sesion || !sesion.token) {
        window.location.href = "index.html";
        return null;
    }
    return sesion.usuario;
}

async function cerrarSesion() {
    try {
        await apiFetch("/auth/logout", { method: "POST" });
    } catch (error) {
        if (error.status !== 401) {
            mostrarNotificacion(error.message, "error");
            return;
        }
    }
    localStorage.removeItem("sesion");
    localStorage.removeItem("clienteActivo");
    window.location.href = "index.html";
}

function aplicarPermisosPorRol(rolActual) {
    document.querySelectorAll("[data-rol]").forEach(el => {
        if (el.getAttribute("data-rol") !== rolActual) {
            el.style.display = "none";
        }
    });
}


// ---------------------------------------------------------------------
// Modo "Contador consulta a un cliente" (solo lectura)
// ---------------------------------------------------------------------
const PAGINAS_DE_DATOS = ["dashboard.html", "movimientos.html", "presupuestos.html", "reportes.html", "analisis.html", "facturacion.html"];
const PAGINAS_CON_EDICION = ["movimientos.html", "presupuestos.html"];

function obtenerClienteActivo() {
    try {
        let sesion = obtenerSesion();
        let cliente = JSON.parse(localStorage.getItem("clienteActivo"));
        // Solo un Contador con sesión puede tener un cliente activo.
        if (!cliente || !sesion || !sesion.usuario || sesion.usuario.rol !== "Contador") {
            localStorage.removeItem("clienteActivo");
            return null;
        }
        return cliente;
    } catch (e) {
        return null;
    }
}

function establecerClienteActivo(cliente) {
    localStorage.setItem("clienteActivo", JSON.stringify(cliente));
}

function salirModoCliente() {
    localStorage.removeItem("clienteActivo");
    recargarDatosCliente();
}

function ocultarDatosCliente() {
    const principal = document.querySelector(".main-content");
    if (principal) principal.style.visibility = "hidden";
}

function recargarDatosCliente() {
    ocultarDatosCliente();
    window.location.reload();
}

const paginaCliente = PAGINAS_DE_DATOS.includes(window.location.pathname.split("/").pop());
if (paginaCliente) {
    window.addEventListener("storage", evento => {
        if (evento.key === "clienteActivo" || evento.key === null) recargarDatosCliente();
    });
    window.addEventListener("pagehide", () => {
        if (obtenerClienteActivo()) ocultarDatosCliente();
    });
    window.addEventListener("pageshow", evento => {
        if (evento.persisted) recargarDatosCliente();
    });
}

function iniciarContadorNotificaciones() {
    const enlace = document.querySelector('[data-page="notificaciones"] a');
    if (!enlace) return;
    const badge = document.createElement("span");
    badge.className = "chat-badge";
    badge.hidden = true;
    enlace.append(" ", badge);
    let enCurso = false;
    let actualizarDespues = false;
    let ultima = 0;

    async function actualizar(forzar = false) {
        if (enCurso) { actualizarDespues ||= forzar; return; }
        if (!forzar && Date.now() - ultima < 2000) return;
        enCurso = true;
        try {
            const { pendientes } = await apiFetch("/notificaciones/pendientes");
            badge.hidden = pendientes === 0;
            badge.textContent = pendientes || "";
            badge.setAttribute("aria-label", `${pendientes} notificaciones pendientes`);
        } catch {
            badge.hidden = true;
        } finally {
            ultima = Date.now();
            enCurso = false;
            if (actualizarDespues) {
                actualizarDespues = false;
                actualizar(true);
            }
        }
    }
    actualizar();
    window.addEventListener("focus", () => actualizar());
    window.addEventListener("notificaciones-actualizadas", () => actualizar(true));
    window.setInterval(() => {
        if (document.visibilityState === "visible") actualizar();
    }, 30000);
}

document.addEventListener("DOMContentLoaded", () => {
    const sesion = obtenerSesion();
    if (sesion?.token) {
        iniciarContadorNotificaciones();
        apiFetch("/auth/sesion").then(usuario => {
            const guardada = obtenerSesion();
            if (guardada?.token !== sesion.token || guardada.usuario.rol === usuario.rol) return;
            if (usuario.rol !== "Contador") localStorage.removeItem("clienteActivo");
            guardada.usuario.rol = usuario.rol;
            localStorage.setItem("sesion", JSON.stringify(guardada));
            window.location.href = "dashboard.html";
        }).catch(() => { /* apiFetch ya gestiona las sesiones inválidas. */ });
    }
    let cliente = obtenerClienteActivo();
    let pagina = window.location.pathname.split("/").pop();
    if (!cliente || !PAGINAS_DE_DATOS.includes(pagina)) return;

    let principal = document.querySelector(".main-content");
    let barra = principal ? principal.querySelector(".topbar") : null;
    if (!principal || !barra) return;

    document.body.classList.add("modo-cliente");
    if (PAGINAS_CON_EDICION.includes(pagina)) document.body.classList.add("pagina-edicion");

    let banner = document.createElement("div");
    banner.className = "banner-cliente";
    let texto = document.createElement("span");
    texto.textContent = `👁 Modo solo lectura: estás viendo los datos de ${cliente.nombre} ${cliente.apellido || ""}`.trim();
    let boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = "Volver a mis datos";
    boton.onclick = salirModoCliente;
    banner.append(texto, boton);
    barra.insertAdjacentElement("afterend", banner);
});
