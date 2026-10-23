const pool = require("../config/db");

async function registrarActividad(idUsuario, accion, modulo, ip) {
    try {
        await pool.query(
            "INSERT INTO HistorialActividad (accion, modulo, ipUsuario, idUsuario) VALUES (?, ?, ?, ?)",
            [accion, modulo, ip || null, idUsuario]
        );
    } catch (error) {
        // El historial nunca debe tumbar la operación principal del usuario.
        console.error("No se pudo registrar actividad:", error.message);
    }
}

module.exports = { registrarActividad };
