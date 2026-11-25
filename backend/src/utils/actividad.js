const pool = require("../config/db");

async function registrarActividad(idUsuario, accion, modulo, ip, conexion) {
    try {
        await (conexion || pool).execute(
            "INSERT INTO HistorialActividad (accion, modulo, ipUsuario, idUsuario) VALUES (?, ?, ?, ?)",
            [accion, modulo, ip || null, idUsuario]
        );
    } catch (error) {
        if (conexion) throw error;
        // El historial nunca debe tumbar la operación principal del usuario.
        console.error("No se pudo registrar actividad:", error.code || error.name);
    }
}

module.exports = { registrarActividad };
