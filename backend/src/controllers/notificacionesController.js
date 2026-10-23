const pool = require("../config/db");

async function listar(req, res) {
    try {
        const [notificaciones] = await pool.query(
            `SELECT idNotificacion, mensaje, fecha, estado
             FROM Notificacion
             WHERE idUsuario = ? AND estado != 'Archivada'
             ORDER BY fecha DESC`,
            [req.usuario.idUsuario]
        );
        return res.json(notificaciones);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener las notificaciones" });
    }
}

async function marcarVista(req, res) {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            "UPDATE Notificacion SET estado = 'Vista' WHERE idNotificacion = ? AND idUsuario = ?",
            [id, req.usuario.idUsuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "No encontrada" });
        }

        return res.json({ mensaje: "Notificación marcada como vista" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al actualizar la notificación" });
    }
}

async function archivar(req, res) {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            "UPDATE Notificacion SET estado = 'Archivada' WHERE idNotificacion = ? AND idUsuario = ?",
            [id, req.usuario.idUsuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "No encontrada" });
        }

        return res.json({ mensaje: "Notificación archivada" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al archivar la notificación" });
    }
}

module.exports = { listar, marcarVista, archivar };
