const pool = require("../config/db");

// Límites del plan Free. El plan Premium no tiene estos límites.
const LIMITES_FREE = {
    presupuestosActivos: 3,
    clientes: 2,
    mesesAnalisis: 3
};

// Umbral (en %) de la alerta preventiva de presupuestos (solo Premium).
const UMBRAL_ALERTA = 80;

// Devuelve "Premium" solo si el usuario tiene el plan Premium contratado,
// activo y vigente (no vencido). En cualquier otro caso devuelve "Free".
async function obtenerPlanEfectivo(idUsuario, conexion = pool) {
    const [filas] = await conexion.execute(
        `SELECT tipoPlan,
                (estado = 'Activa' AND CURDATE() BETWEEN fechaInicio AND fechaFin) AS vigente
         FROM Suscripcion WHERE idUsuario = ?`,
        [idUsuario]
    );
    if (filas.length === 0) return "Free";
    return filas[0].tipoPlan === "Premium" && Number(filas[0].vigente) === 1 ? "Premium" : "Free";
}

async function esPremium(idUsuario, conexion) {
    return (await obtenerPlanEfectivo(idUsuario, conexion)) === "Premium";
}

function beneficiosPlan(plan) {
    const premium = plan === "Premium";
    return {
        presupuestosActivos: premium ? null : LIMITES_FREE.presupuestosActivos,
        clientes: premium ? null : LIMITES_FREE.clientes,
        mesesAnalisis: premium ? null : LIMITES_FREE.mesesAnalisis,
        alertaPreventiva: premium,
        exportarPDF: true,
        exportarExcel: premium
    };
}

function permitePagoSimulado(entorno = process.env) {
    return entorno.NODE_ENV !== "production" && entorno.CONTASYS_SIMULAR_PAGOS !== "false";
}

module.exports = { LIMITES_FREE, UMBRAL_ALERTA, obtenerPlanEfectivo, esPremium, beneficiosPlan, permitePagoSimulado };
