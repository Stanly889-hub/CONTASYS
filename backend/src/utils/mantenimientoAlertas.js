const pool = require("../config/db");
const { enTransaccion } = require("./transaccion");
const { bloquearPresupuestos, reevaluarPresupuesto } = require("./alertasPresupuesto");

function crearEvaluador({ lote = 25 } = {}) {
    let dia;
    let cursor = 0;
    let enCurso;
    async function evaluar() {
        const [[{ hoy }]] = await pool.execute("SELECT CURDATE() AS hoy");
        if (hoy !== dia) { dia = hoy; cursor = 0; }
        const [filas] = await pool.execute(
            `SELECT p.idPresupuesto, p.idUsuario FROM Presupuesto p JOIN Usuario u ON u.idUsuario = p.idUsuario
             WHERE p.fechaInicio <= ? AND p.fechaFin >= ? AND p.estado = 'Activo'
               AND p.idPresupuesto > ? AND u.estado = 'Activo'
             ORDER BY p.idPresupuesto LIMIT ?`, [dia, dia, cursor, lote]
        );
        for (const { idPresupuesto, idUsuario } of filas) {
            await enTransaccion(async conexion => {
                await bloquearPresupuestos(conexion, idUsuario);
                const [[usuario]] = await conexion.execute("SELECT estado FROM Usuario WHERE idUsuario = ?", [idUsuario]);
                if (usuario?.estado === "Activo") await reevaluarPresupuesto(conexion, idUsuario, idPresupuesto);
            });
            cursor = idPresupuesto;
        }
        return filas.length;
    }
    return () => {
        enCurso ||= evaluar().finally(() => { enCurso = null; });
        return enCurso;
    };
}

function iniciarMantenimientoAlertas() {
    const intervalo = Number(process.env.CONTASYS_ALERTAS_INTERVALO_MS || 0);
    if (!Number.isInteger(intervalo) || intervalo < 1000 || intervalo > 86400000) return async () => {};
    const loteConfig = Number(process.env.CONTASYS_ALERTAS_LOTE || 25);
    const lote = Number.isInteger(loteConfig) && loteConfig >= 1 && loteConfig <= 100 ? loteConfig : 25;
    const evaluar = crearEvaluador({ lote });
    let pendiente;
    const timer = setInterval(() => {
        pendiente ||= evaluar().catch(error => console.error("Mantenimiento de alertas:", error.code || error.name))
            .finally(() => { pendiente = null; });
    }, intervalo);
    timer.unref();
    return async () => {
        clearInterval(timer);
        await pendiente;
    };
}

module.exports = { crearEvaluador, iniciarMantenimientoAlertas };
