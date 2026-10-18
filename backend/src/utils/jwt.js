const jwt = require("jsonwebtoken");
require("dotenv").config();

function generarToken(usuario) {
    return jwt.sign(
        {
            idUsuario: usuario.idUsuario,
            correo: usuario.correo,
            rol: usuario.rol
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
}

function verificarToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generarToken, verificarToken };
