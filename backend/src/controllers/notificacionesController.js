const pool = require("../config/db");
const { idValido, responderError } = require("../utils/validacionFinanciera");
const { paginacion, respuestaPagina } = require("../utils/paginacion");

async function pendientes(req, res) {
    try {
        const [[{ total }]] = await pool.execute(
            "SELECT COUNT(*) AS total FROM Notificacion WHERE idUsuario = ? AND estado = 'Pendiente'",
            [req.usuario.idUsuario]
        );
        return res.json({ pendientes: Number(total) });
    } catch (error) {
        return responderError(res, error, "Error al contar las notificaciones");
    }
}

async function listar(req, res) {
    try {
        const pagina = paginacion(req.query);
        const parametros = [req.usuario.idUsuario];
        if (pagina?.fecha) parametros.push(pagina.fecha, pagina.fecha, pagina.id);
        if (pagina) parametros.push(pagina.limite + 1);
        const [notificaciones] = await pool.execute(
            `SELECT idNotificacion, mensaje, fecha, estado
             FROM Notificacion
             WHERE idUsuario = ? AND estado != 'Archivada'
             ${pagina?.fecha ? "AND (fecha < ? OR (fecha = ? AND idNotificacion < ?))" : ""}
             ORDER BY fecha DESC, idNotificacion DESC${pagina ? " LIMIT ?" : ""}`,
            parametros
        );
        return res.json(respuestaPagina(notificaciones, pagina, "fecha", "idNotificacion"));
    } catch (error) {
        return responderError(res, error, "Error al obtener las notificaciones");
    }
}

async function marcarVista(req, res) {
    try {
        const id = idValido(req.params.id);

        const [resultado] = await pool.execute(
            "UPDATE Notificacion SET estado = 'Vista' WHERE idNotificacion = ? AND idUsuario = ? AND estado <> 'Archivada'",
            [id, req.usuario.idUsuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "No encontrada" });
        }

        return res.json({ mensaje: "Notificación marcada como vista" });
    } catch (error) {
        return responderError(res, error, "Error al actualizar la notificación");
    }
}

async function archivar(req, res) {
    try {
        const id = idValido(req.params.id);

        const [resultado] = await pool.execute(
            "UPDATE Notificacion SET estado = 'Archivada' WHERE idNotificacion = ? AND idUsuario = ?",
            [id, req.usuario.idUsuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "No encontrada" });
        }

        return res.json({ mensaje: "Notificación archivada" });
    } catch (error) {
        return responderError(res, error, "Error al archivar la notificación");
    }
}

module.exports = { listar, pendientes, marcarVista, archivar };
