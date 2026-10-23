const pool = require("../config/db");

async function obtener(req, res) {
    try {
        const [filas] = await pool.query(
            "SELECT idSuscripcion, tipoPlan, fechaInicio, fechaFin, estado FROM Suscripcion WHERE idUsuario = ?",
            [req.usuario.idUsuario]
        );

        if (filas.length === 0) {
            return res.status(404).json({ error: "No tienes una suscripción registrada" });
        }

        return res.json(filas[0]);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al obtener la suscripción" });
    }
}

async function cambiarPlan(req, res) {
    try {
        const { tipoPlan } = req.body;

        if (!["Free", "Premium"].includes(tipoPlan)) {
            return res.status(400).json({ error: "Plan inválido" });
        }

        const [resultado] = await pool.query(
            "UPDATE Suscripcion SET tipoPlan = ? WHERE idUsuario = ?",
            [tipoPlan, req.usuario.idUsuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "No tienes una suscripción registrada" });
        }

        return res.json({ mensaje: `Plan actualizado a ${tipoPlan}` });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error al actualizar el plan" });
    }
}

module.exports = { obtener, cambiarPlan };
