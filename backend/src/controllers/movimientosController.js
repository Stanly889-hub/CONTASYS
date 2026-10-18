const pool = require("../config/db");

// Se reutiliza para /api/ingresos y /api/egresos.
// La tabla nunca viene del usuario: la define la ruta ("Ingreso" o "Egreso"),
// por lo que es seguro usarla directo en el SQL.
function crearControladorMovimientos(tabla) {
    const idColumna = tabla === "Ingreso" ? "idIngreso" : "idEgreso";

    async function listar(req, res) {
        try {
            const { fechaDesde, fechaHasta, idCategoria } = req.query;

            let sql = `
                SELECT m.${idColumna} AS id, m.monto, m.descripcion, m.numeroComprobante,
                       m.fecha, m.estadoTransaccion,
                       c.idCategoria, c.nombreCategoria AS categoria,
                       mp.idMetodoPago, mp.nombreMetodo AS metodoPago
                FROM ${tabla} m
                JOIN CategoriaFinanciera c ON m.idCategoria = c.idCategoria
                JOIN MetodoPago mp ON m.idMetodoPago = mp.idMetodoPago
                WHERE m.idUsuario = ?
            `;
            const params = [req.usuario.idUsuario];

            if (fechaDesde) {
                sql += " AND m.fecha >= ?";
                params.push(fechaDesde);
            }
            if (fechaHasta) {
                sql += " AND m.fecha <= ?";
                params.push(fechaHasta);
            }
            if (idCategoria) {
                sql += " AND m.idCategoria = ?";
                params.push(idCategoria);
            }

            sql += " ORDER BY m.fecha DESC";

            const [filas] = await pool.query(sql, params);
            return res.json(filas);

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: `Error al obtener los ${tabla.toLowerCase()}s` });
        }
    }

    async function crear(req, res) {
        try {
            const { monto, descripcion, fecha, idCategoria, idMetodoPago, numeroComprobante } = req.body;

            if (!monto || monto <= 0) {
                return res.status(400).json({ error: "El monto debe ser mayor a cero" });
            }
            if (!descripcion || !fecha || !idCategoria || !idMetodoPago) {
                return res.status(400).json({ error: "Completa todos los campos obligatorios" });
            }

            const [resultado] = await pool.query(
                `INSERT INTO ${tabla} (monto, descripcion, numeroComprobante, fecha, idUsuario, idCategoria, idMetodoPago)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [monto, descripcion, numeroComprobante || null, fecha, req.usuario.idUsuario, idCategoria, idMetodoPago]
            );

            return res.status(201).json({ mensaje: "Registrado correctamente", id: resultado.insertId });

        } catch (error) {
            console.error(error);
            if (error.sqlState === "45000") {
                return res.status(400).json({ error: error.sqlMessage });
            }
            return res.status(500).json({ error: `Error al registrar el ${tabla.toLowerCase()}` });
        }
    }

    async function actualizar(req, res) {
        try {
            const { id } = req.params;
            const { monto, descripcion, fecha, idCategoria, idMetodoPago, numeroComprobante } = req.body;

            const [existentes] = await pool.query(
                `SELECT ${idColumna} FROM ${tabla} WHERE ${idColumna} = ? AND idUsuario = ?`,
                [id, req.usuario.idUsuario]
            );

            if (existentes.length === 0) {
                return res.status(404).json({ error: "No encontrado" });
            }

            if (!monto || monto <= 0) {
                return res.status(400).json({ error: "El monto debe ser mayor a cero" });
            }

            await pool.query(
                `UPDATE ${tabla}
                 SET monto = ?, descripcion = ?, numeroComprobante = ?, fecha = ?, idCategoria = ?, idMetodoPago = ?
                 WHERE ${idColumna} = ?`,
                [monto, descripcion, numeroComprobante || null, fecha, idCategoria, idMetodoPago, id]
            );

            return res.json({ mensaje: "Actualizado correctamente" });

        } catch (error) {
            console.error(error);
            if (error.sqlState === "45000") {
                return res.status(400).json({ error: error.sqlMessage });
            }
            return res.status(500).json({ error: `Error al actualizar el ${tabla.toLowerCase()}` });
        }
    }

    async function eliminar(req, res) {
        try {
            const { id } = req.params;

            const [resultado] = await pool.query(
                `DELETE FROM ${tabla} WHERE ${idColumna} = ? AND idUsuario = ?`,
                [id, req.usuario.idUsuario]
            );

            if (resultado.affectedRows === 0) {
                return res.status(404).json({ error: "No encontrado" });
            }

            return res.json({ mensaje: "Eliminado correctamente" });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: `Error al eliminar el ${tabla.toLowerCase()}` });
        }
    }

    return { listar, crear, actualizar, eliminar };
}

module.exports = { crearControladorMovimientos };
