const pool = require("../config/db");

const CONFIRMADA = "Confirmada";
const PENDIENTE = "Pendiente";
const ESTADOS_MOVIMIENTO = [CONFIRMADA, PENDIENTE, "Anulada"];

function centavos(valor) {
    const [entero, fraccion = ""] = String(valor).replace(/^-/, "").split(".");
    const total = BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, "0"));
    return String(valor).startsWith("-") ? -total : total;
}

function decimal(valor) {
    const absoluto = valor < 0n ? -valor : valor;
    return `${valor < 0n ? "-" : ""}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, "0")}`;
}

function porcentaje(numerador, denominador) {
    if (denominador <= 0n) return 0;
    const magnitud = (numerador < 0n ? -numerador : numerador) * 100n;
    const redondeado = (magnitud * 2n + denominador) / (denominador * 2n);
    const resultado = numerador < 0n ? -redondeado : redondeado;
    return redondeado <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(resultado) : String(resultado);
}

function resumen(filas, estado = CONFIRMADA) {
    let ingresos = 0n;
    let egresos = 0n;
    for (const fila of filas) {
        if (fila.estadoTransaccion !== estado) continue;
        if (fila.tipo === "ingreso") ingresos += centavos(fila.monto);
        else egresos += centavos(fila.monto);
    }
    return { ingresos: decimal(ingresos), egresos: decimal(egresos), balance: decimal(ingresos - egresos) };
}

function agruparGastos(filas) {
    const gastos = new Map();
    for (const fila of filas) {
        if (fila.tipo !== "egreso" || fila.estadoTransaccion !== CONFIRMADA) continue;
        gastos.set(fila.categoria, (gastos.get(fila.categoria) || 0n) + centavos(fila.monto));
    }
    return gastos;
}

function consultarMovimientos({ idUsuario, desde, hasta, detalle = false, mensual = false, recientes = false }) {
    const parametros = [];
    const partes = ["Ingreso", "Egreso"].map(tabla => {
        const filtros = ["m.idUsuario = ?"];
        parametros.push(idUsuario);
        if (desde) { filtros.push("m.fecha >= ?"); parametros.push(desde); }
        if (hasta) { filtros.push("m.fecha <= ?"); parametros.push(hasta); }
        if (!detalle) filtros.push(`m.estadoTransaccion IN ('${CONFIRMADA}', '${PENDIENTE}')`);

        const columnas = detalle
            ? `m.id${tabla} AS id, m.monto, m.descripcion, m.fecha, mp.nombreMetodo AS metodoPago, c.nombreCategoria AS categoria`
            : mensual
                ? "SUM(m.monto) AS monto, DATE_FORMAT(m.fecha, '%Y-%m') AS mes, c.nombreCategoria AS categoria"
                : "SUM(m.monto) AS monto";
        const agrupacion = detalle ? "" : `GROUP BY m.estadoTransaccion${mensual ? ", mes, c.idCategoria, c.nombreCategoria" : ""}`;
        const categoria = detalle || mensual ? "STRAIGHT_JOIN CategoriaFinanciera c ON c.idCategoria = m.idCategoria" : "";
        const metodo = detalle ? "STRAIGHT_JOIN MetodoPago mp ON mp.idMetodoPago = m.idMetodoPago" : "";
        const sql = `SELECT '${tabla.toLowerCase()}' AS tipo, m.estadoTransaccion, ${columnas}
                FROM ${tabla} m ${categoria} ${metodo}
                WHERE ${filtros.join(" AND ")} ${agrupacion}`;
        return recientes ? `(${sql} ORDER BY m.fecha DESC, m.id${tabla} DESC LIMIT 5)` : sql;
    });
    const orden = recientes ? "ORDER BY fecha DESC, id DESC, tipo LIMIT 5"
        : detalle ? "ORDER BY fecha, id, tipo" : "";
    return pool.execute(`${partes.join(" UNION ALL ")} ${orden}`, parametros);
}

module.exports = { CONFIRMADA, PENDIENTE, ESTADOS_MOVIMIENTO, centavos, decimal, porcentaje, resumen, agruparGastos, consultarMovimientos };
