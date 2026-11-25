// Dirección de la API:
// - En desarrollo (localhost o 127.0.0.1) usa el backend local en el puerto 3000.
// - En producción usa "/api" (mismo dominio), o define window.CONTASYS_API_URL
//   en una etiqueta <script> antes de cargar api.js para apuntar a otra dirección.
const API_BASE = window.CONTASYS_API_URL ||
    ((location.hostname === "localhost" || location.hostname === "127.0.0.1")
        ? "http://localhost:3000/api"
        : "/api");

// Rutas de datos financieros que un Contador puede consultar en nombre de un cliente.
const RUTAS_DE_DATOS = /^\/(ingresos|egresos|presupuestos|analisis|reportes|dashboard|facturas)(\/|\?|$)/;

async function apiFetch(ruta, opciones = {}) {
    // Modo "Contador consulta a un cliente": solo lectura.
    const cliente = (typeof obtenerClienteActivo === "function") ? obtenerClienteActivo() : null;
    const esRutaDeDatos = RUTAS_DE_DATOS.test(ruta);
    const metodo = (opciones.method || "GET").toUpperCase();
    if (cliente && esRutaDeDatos) {
        if (metodo !== "GET") {
            throw new Error("Modo solo lectura: no puedes modificar los datos de un cliente");
        }
        ruta += (ruta.includes("?") ? "&" : "?") + "clienteId=" + encodeURIComponent(cliente.idUsuario);
    }

    let sesion = JSON.parse(localStorage.getItem("sesion"));
    let headers = { "Content-Type": "application/json", ...(opciones.headers || {}) };

    if (sesion && sesion.token) {
        headers["Authorization"] = "Bearer " + sesion.token;
    }

    let respuesta;
    try {
        respuesta = await fetch(API_BASE + ruta, { ...opciones, headers });
    } catch (error) {
        if (opciones.signal?.aborted) throw error;
        throw new Error("No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo en unos minutos.");
    }

    // 401 en cualquier ruta EXCEPTO el login = sesión caducada o inválida.
    // En el login, un 401 significa "credenciales inválidas" y debe mostrar ese mensaje.
    if (respuesta.status === 401 && ruta !== "/auth/login") {
        localStorage.removeItem("sesion");
        localStorage.removeItem("clienteActivo");
        if (!location.pathname.endsWith("index.html")) {
            window.location.href = "index.html";
        }
        const errorSesion = new Error("Sesión expirada, inicia sesión de nuevo");
        errorSesion.status = 401;
        throw errorSesion;
    }

    let datos = null;
    try { datos = await respuesta.json(); } catch (e) { /* respuesta sin cuerpo */ }

    if (esRutaDeDatos && typeof obtenerClienteActivo === "function" &&
        cliente?.idUsuario !== obtenerClienteActivo()?.idUsuario) {
        throw new Error("La selección del cliente cambió. Se actualizará la vista.");
    }

    if (!respuesta.ok) {
        const error = new Error((datos && datos.error) || "Error en la petición");
        error.status = respuesta.status;
        throw error;
    }

    if (metodo !== "GET" && /^(?:\/(?:ingresos|egresos|presupuestos|notificaciones|facturas))(?:\/|\?|$)/.test(ruta)) {
        window.dispatchEvent(new Event("notificaciones-actualizadas"));
    }
    return datos;
}
