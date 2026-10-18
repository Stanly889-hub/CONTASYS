const API_BASE = "http://localhost:3000/api";

async function apiFetch(ruta, opciones = {}) {
    let sesion = JSON.parse(localStorage.getItem("sesion"));
    let headers = { "Content-Type": "application/json", ...(opciones.headers || {}) };

    if (sesion && sesion.token) {
        headers["Authorization"] = "Bearer " + sesion.token;
    }

    let respuesta;
    try {
        respuesta = await fetch(API_BASE + ruta, { ...opciones, headers });
    } catch (error) {
        throw new Error("No se pudo conectar con el servidor. ¿Está corriendo el backend (npm run dev)?");
    }

    if (respuesta.status === 401) {
        localStorage.removeItem("sesion");
        if (!location.pathname.endsWith("index.html")) {
            window.location.href = "index.html";
        }
        throw new Error("Sesión expirada, inicia sesión de nuevo");
    }

    let datos = null;
    try { datos = await respuesta.json(); } catch (e) { /* respuesta sin cuerpo */ }

    if (!respuesta.ok) {
        throw new Error((datos && datos.error) || "Error en la petición");
    }

    return datos;
}