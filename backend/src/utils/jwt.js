const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");
require("dotenv").config();

function generarToken(idUsuario) {
    const idSesion = randomUUID();
    const token = jwt.sign(
        { idUsuario },
        process.env.JWT_SECRET,
        { algorithm: "HS256", jwtid: idSesion, expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    return { token, idSesion, exp: jwt.decode(token).exp };
}

function verificarToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
}

module.exports = { generarToken, verificarToken };
