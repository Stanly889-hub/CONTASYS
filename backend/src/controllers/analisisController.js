const pool = require("../config/db");

async function obtenerAnalisis(req, res) {
    try {
        const idUsuario = req.usuario.idUsuario;

        // Tendencia mensual: ingresos y egresos agrupados por mes (ultimos 12 meses con datos)
        const [ingresosPorMes] = await pool.query(
            `SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, SUM(monto) AS total
             FROM Ingreso WHERE idUsuario = ?
             GROUP BY mes ORDER BY mes`,
            [idUsuario]
        );

        const [egresosPorMes] = await pool.query(
            `SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, SUM(monto) AS total
             FROM Egreso WHERE idUsuario = ?
             GROUP BY mes ORDER BY mes`,
            [idUsuario]
        );

        const mesesSet = new Set([...ingresosPorMes.map(m => m.mes), ...egresosPorMes.map(m => m.mes)]);
        const meses = [...mesesSet].sort();

        const mapaIngresos = Object.fromEntries(ingresosPorMes.map(m => [m.mes, Number(m.total)]));
        const mapaEgresos = Object.fromEntries(egresosPorMes.map(m => [m.mes, Number(m.total)]));

        const tendenciaMensual = meses.map(mes => ({
            mes,
            ingresos: mapaIngresos[mes] || 0,
            egresos: mapaEgresos[mes] || 0
        }));

        // Totales historicos y tasa de ahorro
        const [[totalIngresos]] = await pool.query(
            "SELECT COALESCE(SUM(monto),0) AS total FROM Ingreso WHERE idUsuario = ?",
            [idUsuario]
        );
        const [[totalEgresos]] = await pool.query(
            "SELECT COALESCE(SUM(monto),0) AS total FROM Egreso WHERE idUsuario = ?",
            [idUsuario]
        );

        const ingresos = Number(totalIngresos.total);
        const egresos = Number(totalEgresos.total);
        const balance = ingresos - egresos;
        const tasaAhorro = ingresos > 0 ? Math.round((balance / ingresos) * 100) : 0;

        // Top 5 categorias de mayor gasto historico
        const [topCategorias] = await pool.query(
            `SELECT c.nombreCategoria AS categoria, SUM(e.monto) AS total
             FROM Egreso e
             JOIN CategoriaFinanciera c ON e.idCategoria = c.idCategoria
             WHERE e.idUsuario = ?
             GROUP BY c.idCategoria, c.nombreCategoria
             ORDER BY total DESC
             LIMIT 5`,
            [idUsuario]
        );

        return res.json({
            tendenciaMensual,
            totales: { ingresos, egresos, balance, tasaAhorro },
            topCategorias: topCategorias.map(c => ({ categoria: c.categoria, total: Number(c.total) }))
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al generar el análisis financiero" });
    }
}

module.exports = { obtenerAnalisis };
