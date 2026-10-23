const pool = require("../config/db");

async function listar(req, res) {
    try {
        let sql, params;

        if (req.usuario.rol === "Administrador") {
            // El administrador ve la actividad de todos los usuarios.
            sql = `SELECT h.idHistorial, h.accion, h.modulo, h.fecha, h.ipUsuario,
                          CONCAT(u.nombre, ' ', u.apellido) AS usuario
                   FROM HistorialActividad h
                   JOIN Usuario u ON h.idUsuario = u.idUsuario
                   ORDER BY h.fecha DESC
                   LIMIT 100`;
            params = [];
        } else {
            sql = `SELECT h.idHistorial, h.accion, h.modulo, h.fecha, h.ipUsuario,
                          CONCAT(u.nombre, ' ', u.apellido) AS usuario
                   FROM HistorialActividad h
                   JOIN Usuario u ON h.idUsuario = u.idUsuario
                   WHERE h.idUsuario = ?
                   ORDER BY h.fecha DESC
                   LIMIT 100`;
            params = [req.usuario.idUsuario];
        }

        const [filas] = await pool.query(sql, params);
        return res.json(filas);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener el historial de actividad" });
    }
}

module.exports = { listar };
