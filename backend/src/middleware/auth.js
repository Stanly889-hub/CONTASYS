const { verificarToken } = require("../utils/jwt");

function requiereAutenticacion(req, res, next) {
    const encabezado = req.headers["authorization"];

    if (!encabezado || !encabezado.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token no proporcionado" });
    }

    const token = encabezado.split(" ")[1];

    try {
        const payload = verificarToken(token);
        req.usuario = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido o expirado" });
    }
}

module.exports = { requiereAutenticacion };
