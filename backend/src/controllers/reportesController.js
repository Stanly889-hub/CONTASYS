const { PENDIENTE, resumen, agruparGastos, decimal, consultarMovimientos } = require("../utils/finanzas");
const { validarRango, responderError } = require("../utils/validacionFinanciera");

async function generarReporte(req, res) {
    try {
        const { desde, hasta } = req.query;
        validarRango(desde, hasta);
        const [detalle] = await consultarMovimientos({ idUsuario: req.usuario.idUsuario, desde, hasta, detalle: true });
        return res.json({
            desde,
            hasta,
            totales: resumen(detalle),
            pendientes: resumen(detalle, PENDIENTE),
            gastosPorCategoria: Object.fromEntries([...agruparGastos(detalle)].map(([categoria, monto]) => [categoria, decimal(monto)])),
            detalle
        });
    } catch (error) {
        return responderError(res, error, "Error al generar el reporte");
    }
}

async function dashboard(req, res) {
    try {
        const idUsuario = req.usuario.idUsuario;
        const [[filas], [recientes]] = await Promise.all([
            consultarMovimientos({ idUsuario }),
            consultarMovimientos({ idUsuario, detalle: true, recientes: true })
        ]);
        return res.json({ ...resumen(filas), pendientes: resumen(filas, PENDIENTE), recientes });
    } catch (error) {
        return responderError(res, error, "Error al obtener el dashboard");
    }
}

module.exports = { generarReporte, dashboard };
