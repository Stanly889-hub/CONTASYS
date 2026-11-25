const { CONFIRMADA, centavos, decimal, porcentaje } = require("./finanzas");
const { UMBRAL_ALERTA, esPremium } = require("./plan");

async function bloquearPresupuestos(conexion, idUsuario) {
    await conexion.execute("SELECT idUsuario FROM Usuario WHERE idUsuario = ? FOR UPDATE", [idUsuario]);
}

function consumeCupo(estado, fechaFin, hoy) {
    return estado === "Activo" && fechaFin >= hoy;
}

async function consultarPresupuestos(conexion, idUsuario, filtro = "", parametros = []) {
    const [filas] = await conexion.execute(
        `WITH seleccion AS (
            SELECT p.idPresupuesto, p.nombrePresupuesto, p.montoPresupuesto, p.fechaInicio, p.fechaFin, p.estado,
                   p.idUsuario, c.idCategoria, c.nombreCategoria AS categoria, c.tipo
            FROM Presupuesto p JOIN CategoriaFinanciera c ON c.idCategoria = p.idCategoria
            WHERE p.idUsuario = ? ${filtro}
         ), rangos AS (
            SELECT DISTINCT idUsuario, idCategoria, tipo, fechaInicio, fechaFin FROM seleccion
         ), ejecucion AS (
            SELECT r.idCategoria, r.fechaInicio, r.fechaFin, SUM(i.monto) AS total
            FROM rangos r JOIN Ingreso i ON i.idUsuario = r.idUsuario AND i.idCategoria = r.idCategoria
                AND i.estadoTransaccion = ? AND i.fecha BETWEEN r.fechaInicio AND r.fechaFin
            WHERE r.tipo = 'Ingreso' GROUP BY r.idCategoria, r.fechaInicio, r.fechaFin
            UNION ALL
            SELECT r.idCategoria, r.fechaInicio, r.fechaFin, SUM(e.monto) AS total
            FROM rangos r JOIN Egreso e ON e.idUsuario = r.idUsuario AND e.idCategoria = r.idCategoria
                AND e.estadoTransaccion = ? AND e.fecha BETWEEN r.fechaInicio AND r.fechaFin
            WHERE r.tipo = 'Egreso' GROUP BY r.idCategoria, r.fechaInicio, r.fechaFin
         )
         SELECT s.idPresupuesto, s.nombrePresupuesto, s.montoPresupuesto, s.fechaInicio, s.fechaFin, s.estado,
                s.idCategoria, s.categoria, s.tipo, CURDATE() AS hoy, COALESCE(e.total,0.00) AS total
         FROM seleccion s LEFT JOIN ejecucion e USING (idCategoria, fechaInicio, fechaFin)
         ORDER BY s.fechaInicio DESC, s.idPresupuesto DESC`,
        [idUsuario, ...parametros, CONFIRMADA, CONFIRMADA]
    );
    return filas;
}

function evaluar(p, premium) {
    const ejecutado = centavos(p.total);
    const meta = centavos(p.montoPresupuesto);
    const ingreso = p.tipo === "Ingreso";
    const excedido = !ingreso && ejecutado > meta;
    const metaAlcanzada = ingreso && ejecutado >= meta;
    const limiteAlcanzado = !ingreso && ejecutado === meta;
    const vigente = consumeCupo(p.estado, p.fechaFin, p.hoy) && p.fechaInicio <= p.hoy;
    const alertaPreventiva = vigente && premium && ejecutado < meta && ejecutado * 100n >= meta * BigInt(UMBRAL_ALERTA);
    const evento = vigente && (
        excedido ? "Exceso" : metaAlcanzada ? "MetaAlcanzada" :
            limiteAlcanzado ? "LimiteAlcanzado" : alertaPreventiva ? "Preventiva" : null
    );
    return {
        ejecucion: { ejecutado: decimal(ejecutado), disponible: decimal(meta - ejecutado),
            porcentaje: porcentaje(ejecutado, meta), excedido, metaAlcanzada, limiteAlcanzado, alertaPreventiva },
        evento
    };
}

async function reevaluar(conexion, idUsuario, filtro, parametros) {
    const filas = await consultarPresupuestos(conexion, idUsuario, filtro, parametros);
    if (!filas.length) return;
    const premium = await esPremium(idUsuario, conexion);
    for (const p of filas) {
        const { evento } = evaluar(p, premium);
        if (!evento) continue;
        const [[existente]] = await conexion.execute(
            "SELECT 1 FROM EventoPresupuesto WHERE idPresupuesto = ? AND tipo = ?", [p.idPresupuesto, evento]
        );
        if (existente) continue;
        const nombre = `«${p.nombrePresupuesto}»`;
        const mensajes = {
            Preventiva: `El presupuesto ${nombre} alcanzó al menos el ${UMBRAL_ALERTA}% de su ${p.tipo === "Ingreso" ? "meta de ingresos" : "límite de egresos"}`,
            LimiteAlcanzado: `El presupuesto ${nombre} alcanzó su límite de egresos`,
            Exceso: `El presupuesto ${nombre} superó su límite de egresos`,
            MetaAlcanzada: `El presupuesto ${nombre} alcanzó su meta de ingresos`
        };
        const [n] = await conexion.execute("INSERT INTO Notificacion (mensaje, idUsuario) VALUES (?, ?)", [mensajes[evento], idUsuario]);
        await conexion.execute(
            "INSERT INTO EventoPresupuesto (idPresupuesto, tipo, idNotificacion) VALUES (?, ?, ?)",
            [p.idPresupuesto, evento, n.insertId]
        );
    }
}

function reevaluarPresupuesto(conexion, idUsuario, idPresupuesto) {
    return reevaluar(conexion, idUsuario, "AND p.idPresupuesto = ?", [idPresupuesto]);
}

function reevaluarMovimientos(conexion, idUsuario, movimientos) {
    const confirmados = movimientos.filter(m => m?.estadoTransaccion === CONFIRMADA);
    if (!confirmados.length) return;
    const filtros = confirmados.map(() => "(p.idCategoria = ? AND ? BETWEEN p.fechaInicio AND p.fechaFin)");
    return reevaluar(conexion, idUsuario,
        `AND p.estado = 'Activo' AND CURDATE() BETWEEN p.fechaInicio AND p.fechaFin AND (${filtros.join(" OR ")})`,
        confirmados.flatMap(m => [m.idCategoria, m.fecha])
    );
}

module.exports = { bloquearPresupuestos, consumeCupo, consultarPresupuestos, evaluar, reevaluarPresupuesto, reevaluarMovimientos };
