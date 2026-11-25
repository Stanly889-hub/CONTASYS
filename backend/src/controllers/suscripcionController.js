const pool = require("../config/db");
const { LIMITES_FREE, UMBRAL_ALERTA, obtenerPlanEfectivo, beneficiosPlan, permitePagoSimulado } = require("../utils/plan");
const { registrarActividad } = require("../utils/actividad");
const { enTransaccion } = require("../utils/transaccion");
const { bloquearPresupuestos } = require("../utils/alertasPresupuesto");

async function obtener(req, res) {
    try {
        const [filas] = await pool.query(
            "SELECT idSuscripcion, tipoPlan, fechaInicio, fechaFin, estado FROM Suscripcion WHERE idUsuario = ?",
            [req.usuario.idUsuario]
        );

        if (filas.length === 0) {
            return res.status(404).json({ error: "No tienes una suscripción registrada" });
        }

        // planEfectivo: "Premium" solo si está activo y vigente; si venció, se trata como "Free".
        const planEfectivo = await obtenerPlanEfectivo(req.usuario.idUsuario);

        return res.json({ ...filas[0], planEfectivo, limitesFree: LIMITES_FREE, umbralAlerta: UMBRAL_ALERTA,
            beneficios: beneficiosPlan(planEfectivo), pagoSimuladoDisponible: permitePagoSimulado() });

    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al obtener la suscripción" });
    }
}

async function cambiarPlan(req, res) {
    try {
        const { tipoPlan } = req.body;

        if (!["Free", "Premium"].includes(tipoPlan)) {
            return res.status(400).json({ error: "Plan inválido" });
        }
        if (tipoPlan === "Premium" && !permitePagoSimulado()) {
            return res.status(403).json({ error: "La contratación y renovación simuladas no están disponibles en este entorno" });
        }

        // Premium: vigencia de 1 mes (pago simulado). Free: vigencia de 1 año.
        const premium = tipoPlan === "Premium";
        const [resultado] = await enTransaccion(async conexion => {
            await bloquearPresupuestos(conexion, req.usuario.idUsuario);
            const [[actual]] = await conexion.execute(
                `SELECT fechaInicio, fechaFin, CURDATE() AS hoy,
                    (tipoPlan = 'Premium' AND estado = 'Activa' AND CURDATE() BETWEEN fechaInicio AND fechaFin) AS renovar
                 FROM Suscripcion WHERE idUsuario = ? FOR UPDATE`, [req.usuario.idUsuario]
            );
            if (!actual) return [{ affectedRows: 0 }];
            const renovar = premium && Number(actual.renovar) === 1;
            return conexion.execute(
                `UPDATE Suscripcion SET tipoPlan = ?, fechaInicio = ?,
                   fechaFin = DATE_ADD(?, ${premium ? "INTERVAL 1 MONTH" : "INTERVAL 1 YEAR"}), estado = 'Activa'
                 WHERE idUsuario = ?`,
                [tipoPlan, renovar ? actual.fechaInicio : actual.hoy, renovar ? actual.fechaFin : actual.hoy, req.usuario.idUsuario]
            );
        });

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "No tienes una suscripción registrada" });
        }

        await registrarActividad(req.usuario.idUsuario, premium ? "Activación o renovación Premium (pago simulado)" : "Cambio de plan a Free", "Suscripción", req.ip);

        return res.json({ mensaje: premium ? "Premium actualizado mediante pago simulado" : "Plan actualizado a Free", pagoSimulado: premium });

    } catch (error) {
        console.error("Error de API:", error.code || error.name);
        return res.status(500).json({ error: "Error al actualizar el plan" });
    }
}

module.exports = { obtener, cambiarPlan };
