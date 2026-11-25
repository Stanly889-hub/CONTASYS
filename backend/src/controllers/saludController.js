const pool = require("../config/db");

const objetos = [
    "Rol", "Usuario", "CategoriaFinanciera", "MetodoPago", "Ingreso", "Egreso",
    "Presupuesto", "Reporte", "Mensaje", "Notificacion", "Suscripcion",
    "HistorialActividad", "ClienteContador", "Sesion", "EventoPresupuesto", "Factura", "FacturaDetalle", "PagoFactura", "vw_balance_por_usuario"
];
// Comprueba que la cuenta de la API pueda consultar los objetos sin devolver datos.
const consulta = [
    ...objetos.map(nombre => `SELECT 1 FROM ${nombre} WHERE 1 = 0`),
    "SELECT 1 FROM Factura WHERE 1 = 0 AND borradorDatos IS NULL",
    "SELECT 1 FROM ClienteContador WHERE 1 = 0 AND facturasAutorizadas IS NULL"
].join(" UNION ALL ");
let comprobacion;

function comprobarMySQL() {
    if (comprobacion) return comprobacion;

    const operacion = pool.query({ sql: consulta, timeout: 2000 });
    comprobacion = new Promise(resolve => {
        // El límite también cubre el tiempo de espera por una conexión del pool.
        const plazo = setTimeout(() => resolve(false), 2500);
        operacion.then(() => resolve(true), () => resolve(false)).finally(() => {
            clearTimeout(plazo);
            comprobacion = undefined;
        });
    });
    return comprobacion;
}

async function salud(req, res) {
    res.set("Cache-Control", "no-store");
    if (await comprobarMySQL()) {
        return res.json({ estado: "ok", mensaje: "CONTASYS API funcionando" });
    }
    return res.status(503).json({ estado: "no_disponible", mensaje: "Servicio temporalmente no disponible" });
}

module.exports = { salud };
