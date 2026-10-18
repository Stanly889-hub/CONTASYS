const pool = require("../config/db");

async function generarReporte(req, res) {
    try {
        const { desde, hasta } = req.query;

        if (!desde || !hasta) {
            return res.status(400).json({ error: "Debes indicar 'desde' y 'hasta'" });
        }

        const idUsuario = req.usuario.idUsuario;

        const [ingresos] = await pool.query(
            `SELECT i.idIngreso AS id, 'ingreso' AS tipo, i.monto, i.descripcion, i.fecha,
                    c.nombreCategoria AS categoria, mp.nombreMetodo AS metodoPago
             FROM Ingreso i
             JOIN CategoriaFinanciera c ON i.idCategoria = c.idCategoria
             JOIN MetodoPago mp ON i.idMetodoPago = mp.idMetodoPago
             WHERE i.idUsuario = ? AND i.fecha BETWEEN ? AND ?`,
            [idUsuario, desde, hasta]
        );

        const [egresos] = await pool.query(
            `SELECT e.idEgreso AS id, 'egreso' AS tipo, e.monto, e.descripcion, e.fecha,
                    c.nombreCategoria AS categoria, mp.nombreMetodo AS metodoPago
             FROM Egreso e
             JOIN CategoriaFinanciera c ON e.idCategoria = c.idCategoria
             JOIN MetodoPago mp ON e.idMetodoPago = mp.idMetodoPago
             WHERE e.idUsuario = ? AND e.fecha BETWEEN ? AND ?`,
            [idUsuario, desde, hasta]
        );

        const detalle = [...ingresos, ...egresos].sort((a, b) => a.fecha.localeCompare(b.fecha));

        const totalIngresos = ingresos.reduce((s, m) => s + Number(m.monto), 0);
        const totalEgresos = egresos.reduce((s, m) => s + Number(m.monto), 0);

        const gastosPorCategoria = {};
        egresos.forEach(e => {
            gastosPorCategoria[e.categoria] = (gastosPorCategoria[e.categoria] || 0) + Number(e.monto);
        });

        return res.json({
            desde,
            hasta,
            totales: {
                ingresos: totalIngresos,
                egresos: totalEgresos,
                balance: totalIngresos - totalEgresos
            },
            gastosPorCategoria,
            detalle
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al generar el reporte" });
    }
}

async function dashboard(req, res) {
    try {
        const idUsuario = req.usuario.idUsuario;

        const [[balance]] = await pool.query(
            "SELECT * FROM vw_balance_por_usuario WHERE idUsuario = ?",
            [idUsuario]
        );

        const [[totalIngresos]] = await pool.query(
            "SELECT COALESCE(SUM(monto),0) AS total FROM Ingreso WHERE idUsuario = ?",
            [idUsuario]
        );

        const [[totalEgresos]] = await pool.query(
            "SELECT COALESCE(SUM(monto),0) AS total FROM Egreso WHERE idUsuario = ?",
            [idUsuario]
        );

        const [recientes] = await pool.query(
            `(SELECT 'ingreso' AS tipo, i.monto, i.descripcion, i.fecha, c.nombreCategoria AS categoria
              FROM Ingreso i JOIN CategoriaFinanciera c ON i.idCategoria = c.idCategoria
              WHERE i.idUsuario = ?)
             UNION ALL
             (SELECT 'egreso' AS tipo, e.monto, e.descripcion, e.fecha, c.nombreCategoria AS categoria
              FROM Egreso e JOIN CategoriaFinanciera c ON e.idCategoria = c.idCategoria
              WHERE e.idUsuario = ?)
             ORDER BY fecha DESC
             LIMIT 5`,
            [idUsuario, idUsuario]
        );

        return res.json({
            ingresos: totalIngresos.total,
            egresos: totalEgresos.total,
            balance: balance ? balance.balance : 0,
            recientes
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener el dashboard" });
    }
}

module.exports = { generarReporte, dashboard };
