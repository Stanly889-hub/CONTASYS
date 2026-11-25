const pool = require("../config/db");
const { paginacion, respuestaPagina } = require("../utils/paginacion");
const { responderError } = require("../utils/validacionFinanciera");

async function listar(req, res) {
    try {
        const pagina = paginacion(req.query);
        const filtros = [];
        const params = [];
        if (req.usuario.rol !== "Administrador") {
            filtros.push("h.idUsuario = ?");
            params.push(req.usuario.idUsuario);
        }
        if (pagina?.fecha) {
            filtros.push("(h.fecha < ? OR (h.fecha = ? AND h.idHistorial < ?))");
            params.push(pagina.fecha, pagina.fecha, pagina.id);
        }
        params.push(pagina ? pagina.limite + 1 : 100);
        const [filas] = await pool.execute(
            `SELECT h.idHistorial,h.accion,h.modulo,h.fecha,h.ipUsuario,CONCAT(u.nombre,' ',u.apellido) AS usuario
             FROM HistorialActividad h JOIN Usuario u ON h.idUsuario = u.idUsuario
             ${filtros.length ? "WHERE " + filtros.join(" AND ") : ""}
             ORDER BY h.fecha DESC, h.idHistorial DESC LIMIT ?`, params
        );
        return res.json(respuestaPagina(filas, pagina, "fecha", "idHistorial"));
    } catch (error) {
        return responderError(res, error, "Error al obtener el historial de actividad");
    }
}

module.exports = { listar };
