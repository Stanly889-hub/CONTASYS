const pool = require("../config/db");
const { LIMITES_FREE, esPremium } = require("../utils/plan");
const { CONFIRMADA, PENDIENTE, centavos, decimal, porcentaje, resumen, agruparGastos, consultarMovimientos } = require("../utils/finanzas");
const { responderError } = require("../utils/validacionFinanciera");

async function obtenerAnalisis(req, res) {
    try {
        const idUsuario = req.usuario.idUsuario;
        const premium = await esPremium(req.contador?.idUsuario ?? idUsuario);
        const [[periodo]] = await pool.query(
            `SELECT CURDATE() AS hasta,
                    DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ${LIMITES_FREE.mesesAnalisis - 1} MONTH), '%Y-%m-01') AS inicioFree`
        );
        const desde = premium ? null : periodo.inicioFree;
        const [filas] = await consultarMovimientos({ idUsuario, desde, hasta: periodo.hasta, mensual: true });
        const totales = resumen(filas);
        const gruposMensuales = new Map();
        for (const fila of filas) {
            if (fila.estadoTransaccion !== CONFIRMADA) continue;
            if (!gruposMensuales.has(fila.mes)) gruposMensuales.set(fila.mes, []);
            gruposMensuales.get(fila.mes).push(fila);
        }
        const tendenciaMensual = [...gruposMensuales.keys()].sort().map(mes => ({ mes, ...resumen(gruposMensuales.get(mes)) }));
        const topCategorias = [...agruparGastos(filas)]
            .sort(([a, montoA], [b, montoB]) => montoA === montoB ? a.localeCompare(b) : montoA > montoB ? -1 : 1)
            .slice(0, 5).map(([categoria, monto]) => ({ categoria, total: decimal(monto) }));

        return res.json({
            plan: premium ? "Premium" : "Free",
            limitado: !premium,
            mesesIncluidos: premium ? null : LIMITES_FREE.mesesAnalisis,
            desde,
            hasta: periodo.hasta,
            tendenciaMensual,
            totales: { ...totales, tasaAhorro: porcentaje(centavos(totales.balance), centavos(totales.ingresos)) },
            pendientes: resumen(filas, PENDIENTE),
            topCategorias
        });
    } catch (error) {
        return responderError(res, error, "Error al generar el análisis financiero");
    }
}

module.exports = { obtenerAnalisis };
