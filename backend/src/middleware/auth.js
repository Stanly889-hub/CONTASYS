const pool = require("../config/db");
const { verificarToken } = require("../utils/jwt");

async function requiereAutenticacion(req, res, next) {
    // Las rutas financieras pueden aplicar este middleware dos veces.
    if (req.idSesion) return next();

    const encabezado = req.get("Authorization");
    if (!encabezado || !encabezado.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token no proporcionado" });
    }

    let payload;
    try {
        payload = verificarToken(encabezado.slice(7));
        if (typeof payload.jti !== "string" || !Number.isInteger(payload.idUsuario)) {
            return res.status(401).json({ error: "Sesión inválida" });
        }
    } catch {
        return res.status(401).json({ error: "Token inválido o expirado" });
    }

    try {
        const [[usuario]] = await pool.execute(
            `SELECT u.idUsuario, u.correo, r.nombreRol AS rol
             FROM Sesion s JOIN Usuario u ON u.idUsuario = s.idUsuario
             JOIN Rol r ON r.idRol = u.idRol
             WHERE s.idSesion = ? AND s.idUsuario = ? AND s.revocada = FALSE
               AND s.expiraUnix > UNIX_TIMESTAMP() AND u.estado = 'Activo'`,
            [payload.jti, payload.idUsuario]
        );
        if (!usuario) return res.status(401).json({ error: "Sesión inválida o revocada" });

        req.idSesion = payload.jti;
        req.usuario = usuario;
        res.set("Cache-Control", "no-store");
        return next();
    } catch (error) {
        console.error("Error al validar la sesión:", error.code || error.name);
        return res.status(503).json({ error: "No se pudo validar la sesión" });
    }
}

module.exports = { requiereAutenticacion };
