const pool = require("../config/db");

async function listar(req, res) {
    try {
        const [presupuestos] = await pool.query(
            `SELECT p.idPresupuesto, p.nombrePresupuesto, p.montoPresupuesto,
                    p.fechaInicio, p.fechaFin, c.idCategoria, c.nombreCategoria AS categoria
             FROM Presupuesto p
             JOIN CategoriaFinanciera c ON p.idCategoria = c.idCategoria
             WHERE p.idUsuario = ?
             ORDER BY p.fechaInicio DESC`,
            [req.usuario.idUsuario]
        );

        for (const presupuesto of presupuestos) {
            const tablaMovimiento = await obtenerTablaPorCategoria(presupuesto.idCategoria);

            const [[{ total }]] = await pool.query(
                `SELECT COALESCE(SUM(monto),0) AS total
                 FROM ${tablaMovimiento}
                 WHERE idCategoria = ? AND idUsuario = ? AND fecha BETWEEN ? AND ?`,
                [presupuesto.idCategoria, req.usuario.idUsuario, presupuesto.fechaInicio, presupuesto.fechaFin]
            );

            const ejecutado = Number(total);
            const monto = Number(presupuesto.montoPresupuesto);

            presupuesto.montoPresupuesto = monto;
            presupuesto.ejecutado = ejecutado;
            presupuesto.porcentaje = monto > 0 ? Math.round((ejecutado / monto) * 100) : 0;
            presupuesto.excedido = ejecutado > monto;

            if (presupuesto.excedido) {
                await asegurarNotificacionExcedido(req.usuario.idUsuario, presupuesto);
            }
        }

        return res.json(presupuestos);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener los presupuestos" });
    }
}

async function asegurarNotificacionExcedido(idUsuario, presupuesto) {
    const mensaje = `El presupuesto "${presupuesto.nombrePresupuesto}" fue excedido`;

    const [existentes] = await pool.query(
        `SELECT idNotificacion FROM Notificacion
         WHERE idUsuario = ? AND mensaje = ? AND estado != 'Archivada'`,
        [idUsuario, mensaje]
    );

    if (existentes.length === 0) {
        await pool.query(
            "INSERT INTO Notificacion (mensaje, estado, idUsuario) VALUES (?, 'Pendiente', ?)",
            [mensaje, idUsuario]
        );
    }
}

async function obtenerTablaPorCategoria(idCategoria) {
    const [[categoria]] = await pool.query(
        "SELECT tipo FROM CategoriaFinanciera WHERE idCategoria = ?",
        [idCategoria]
    );
    return categoria.tipo === "Ingreso" ? "Ingreso" : "Egreso";
}

async function crear(req, res) {
    try {
        const { nombrePresupuesto, idCategoria, montoPresupuesto, fechaInicio, fechaFin } = req.body;

        if (!nombrePresupuesto || !idCategoria || !montoPresupuesto || !fechaInicio || !fechaFin) {
            return res.status(400).json({ error: "Completa todos los campos" });
        }
        if (montoPresupuesto <= 0) {
            return res.status(400).json({ error: "El monto debe ser mayor a cero" });
        }
        if (fechaInicio > fechaFin) {
            return res.status(400).json({ error: "La fecha inicial no puede ser mayor que la final" });
        }

        const [resultado] = await pool.query(
            `INSERT INTO Presupuesto (nombrePresupuesto, montoPresupuesto, fechaInicio, fechaFin, idUsuario, idCategoria)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nombrePresupuesto, montoPresupuesto, fechaInicio, fechaFin, req.usuario.idUsuario, idCategoria]
        );

        return res.status(201).json({ mensaje: "Presupuesto creado", id: resultado.insertId });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al crear el presupuesto" });
    }
}

async function actualizar(req, res) {
    try {
        const { id } = req.params;
        const { nombrePresupuesto, idCategoria, montoPresupuesto, fechaInicio, fechaFin } = req.body;

        const [existentes] = await pool.query(
            "SELECT idPresupuesto FROM Presupuesto WHERE idPresupuesto = ? AND idUsuario = ?",
            [id, req.usuario.idUsuario]
        );

        if (existentes.length === 0) {
            return res.status(404).json({ error: "No encontrado" });
        }

        await pool.query(
            `UPDATE Presupuesto
             SET nombrePresupuesto = ?, montoPresupuesto = ?, fechaInicio = ?, fechaFin = ?, idCategoria = ?
             WHERE idPresupuesto = ?`,
            [nombrePresupuesto, montoPresupuesto, fechaInicio, fechaFin, idCategoria, id]
        );

        return res.json({ mensaje: "Presupuesto actualizado" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al actualizar el presupuesto" });
    }
}

async function eliminar(req, res) {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            "DELETE FROM Presupuesto WHERE idPresupuesto = ? AND idUsuario = ?",
            [id, req.usuario.idUsuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "No encontrado" });
        }

        return res.json({ mensaje: "Presupuesto eliminado" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al eliminar el presupuesto" });
    }
}

module.exports = { listar, crear, actualizar, eliminar };
