// Limita los intentos fallidos de login por combinación IP + correo.
// Se guarda en memoria: se reinicia si el servidor se reinicia.

const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000; // 15 minutos
const MAX_REGISTROS = 10000;

const intentos = new Map(); // clave -> { cuenta, desde }
const limpieza = setInterval(() => {
    const ahora = Date.now();
    for (const k of intentos.keys()) limpiarVencidos(k, ahora);
}, 60000);
limpieza.unref();

function clave(req) {
    const correo = req.body.correo.trim().toLowerCase().slice(0, 100);
    return `${req.ip}|${correo}`;
}

function limpiarVencidos(k, ahora) {
    const registro = intentos.get(k);
    if (registro && ahora - registro.desde >= VENTANA_MS) {
        intentos.delete(k);
    }
}

// Devuelve los minutos restantes de bloqueo, o 0 si puede intentar.
function minutosDeBloqueo(req) {
    const k = clave(req);
    const ahora = Date.now();
    limpiarVencidos(k, ahora);
    const registro = intentos.get(k);
    if (registro && registro.cuenta >= MAX_INTENTOS) {
        return Math.ceil((VENTANA_MS - (ahora - registro.desde)) / 60000);
    }
    if (!registro && intentos.size >= MAX_REGISTROS) return 1;
    return 0;
}

function registrarFallo(req) {
    const k = clave(req);
    const ahora = Date.now();
    limpiarVencidos(k, ahora);
    if (!intentos.has(k) && intentos.size >= MAX_REGISTROS) return;
    const registro = intentos.get(k) || { cuenta: 0, desde: ahora };
    registro.cuenta += 1;
    intentos.set(k, registro);
}

function limpiarIntentos(req) {
    intentos.delete(clave(req));
}

module.exports = { minutosDeBloqueo, registrarFallo, limpiarIntentos };
