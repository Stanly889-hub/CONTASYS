const { randomBytes } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { performance } = require("node:perf_hooks");
const assert = require("node:assert/strict");
const mysql = require("mysql2/promise");

async function ejecutarSql(conexion, archivo, { omitirCatalogos = false } = {}) {
    let delimitador = ";";
    let sentencia = "";
    for (const linea of readFileSync(resolve(__dirname, "../../database", archivo), "utf8").split(/\r?\n/)) {
        const limpia = linea.trim();
        if (!limpia || limpia.startsWith("--")) continue;
        if (limpia.startsWith("DELIMITER ")) { delimitador = limpia.slice(10); continue; }
        if (/^(USE|DROP|TRUNCATE|CREATE\s+DATABASE)\b/i.test(limpia)) throw new Error("SQL incompatible con las pruebas aisladas");
        sentencia += linea + "\n";
        if (limpia.endsWith(delimitador)) {
            const sql = sentencia.trimEnd().slice(0, -delimitador.length);
            if (omitirCatalogos && /^INSERT INTO (Rol|CategoriaFinanciera|MetodoPago)\b/i.test(sql.trim())) {
                sentencia = "";
                continue;
            }
            const indice = sql.match(/^CREATE INDEX (\w+) ON (\w+)/i);
            const [[existe]] = indice ? await conexion.execute(
                "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
                [indice[2], indice[1]]
            ) : [[]];
            if (!existe) await conexion.query(sql);
            sentencia = "";
        }
    }
    if (sentencia) throw new Error("Sentencia sin delimitar");
}

async function sembrar(db, n) {
    await db.query(`INSERT INTO Usuario (documento,nombre,apellido,correo,password_hash,fechaRegistro,idRol) VALUES
        ('perf1','Titular','Prueba','perf1@example.invalid','demo',CURDATE(),3),
        ('perf2','Contacto','Prueba','perf2@example.invalid','demo',CURDATE(),2)`);
    await db.query(`INSERT INTO Suscripcion (tipoPlan,fechaInicio,fechaFin,idUsuario)
        VALUES ('Premium',CURDATE(),DATE_ADD(CURDATE(),INTERVAL 1 MONTH),1)`);
    const [[{ hoy, inicio }]] = await db.query(
        "SELECT CAST(CURDATE() AS CHAR) hoy, CAST(DATE_SUB(CURDATE(), INTERVAL 365 DAY) AS CHAR) inicio"
    );
    const fecha = i => new Date(Date.parse(hoy + "T00:00:00Z") - (i % 365) * 86400000).toISOString().slice(0, 10);
    for (let inicioLote = 0; inicioLote < n; inicioLote += 500) {
        const numeros = Array.from({ length: Math.min(n - inicioLote, 500) }, (_, i) => inicioLote + i);
        const estados = ["Confirmada", "Confirmada", "Confirmada", "Pendiente", "Anulada"];
        for (const [tabla, categoria] of [["Ingreso", 1], ["Egreso", 4]]) {
            await db.query(`INSERT INTO ${tabla} (monto,descripcion,fecha,idUsuario,idCategoria,idMetodoPago,estadoTransaccion) VALUES ?`,
                [numeros.map(i => ["10.23", "Registro ficticio para rendimiento", fecha(i), i % 7 === 0 ? 2 : 1, categoria + i % 3, 1, estados[i % 5]])]);
        }
        await db.query("INSERT INTO Mensaje (contenido,idEmisor,idReceptor) VALUES ?",
            [numeros.map(i => ["Mensaje ficticio de la conversación de rendimiento", i % 2 + 1, 2 - i % 2])]);
        await db.query("INSERT INTO Notificacion (mensaje,estado,idUsuario) VALUES ?",
            [numeros.map(i => ["Notificación ficticia", ["Pendiente", "Vista", "Archivada"][i % 3], i % 7 === 0 ? 2 : 1])]);
        await db.query("INSERT INTO HistorialActividad (accion,modulo,idUsuario) VALUES ?",
            [numeros.map(() => ["Actividad ficticia", "Pruebas", 1])]);
        await db.query(`INSERT INTO Factura (idUsuario,consecutivo,fecha,estado,emisorNombre,emisorDocumento,emisorCorreo,
            receptorNombre,receptorDocumento,subtotal,descuento,impuesto,total,fechaEmision) VALUES ?`,
            [numeros.map(i => [i % 7 === 0 ? 2 : 1,i + 1,fecha(i),"Pendiente","Prueba","P","p@example.invalid",
                "Receptor ficticio","R" + i,"10.23","0.00","0.00","10.23",hoy + " 00:00:00"])]);
    }
    await db.query("INSERT INTO Presupuesto (nombrePresupuesto,montoPresupuesto,fechaInicio,fechaFin,idUsuario,idCategoria) VALUES ?",
        [Array.from({ length: n === 100 ? 6 : n === 1000 ? 30 : 100 }, (_, i) => ["Meta ficticia " + i, "1000.00", inicio, hoy, 1, i % 2 ? 1 : 4])]);
}

async function principal() {
    const [modo, volumen, archivo] = process.argv.slice(2);
    const n = Number(volumen);
    if (!["antes", "despues"].includes(modo) || ![100, 1000, 10000].includes(n) || !archivo) {
        throw new Error("Uso: node scripts/medir-rendimiento.js antes|despues 100|1000|10000 ruta-base.json");
    }
    require("dotenv").config({ quiet: true, path: resolve(__dirname, "../.env") });
    const esquema = modo === "antes" ? `contasys_prueba_perf_${n}_${randomBytes(4).toString("hex")}`
        : JSON.parse(readFileSync(archivo, "utf8")).esquema;
    if (!new RegExp(`^contasys_prueba_perf_${n}_[a-f0-9]{8}$`).test(esquema)) throw new Error("Esquema de rendimiento inválido");
    const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD });
    let servidor;
    let pool;
    try {
        if (modo === "antes") await db.query(`CREATE DATABASE \`${esquema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.changeUser({ database: esquema });
        if (modo === "antes") {
            for (const f of ["CONTASYS_PRODUCCION", "MIGRACION_ROLES_PREMIUM", "MIGRACION_SESIONES", "MIGRACION_PROTEGER_USUARIOS",
                "MIGRACION_PROTEGER_VINCULOS", "MIGRACION_ALERTAS_PRESUPUESTO", "MIGRACION_TIPO_CATEGORIA", "MIGRACION_FACTURACION",
                "MIGRACION_FACTURAS_CONCILIACION", "MIGRACION_CORRECCION_PAGOS"]) await ejecutarSql(db, f + ".sql");
            await sembrar(db, n);
        } else {
            await ejecutarSql(db, "MIGRACION_RENDIMIENTO.sql");
        }
        process.env.DB_NAME = esquema;
        process.env.JWT_SECRET = randomBytes(32).toString("hex");
        process.env.CORS_ORIGIN = "";
        pool = require("../src/config/db");
        const consultas = [];
        for (const metodo of ["query", "execute"]) {
            const original = pool[metodo].bind(pool);
            pool[metodo] = (sql, params) => { consultas.push({ sql: sql.sql || sql, params }); return original(sql, params); };
        }
        const { generarToken } = require("../src/utils/jwt");
        const sesion = generarToken(1);
        await db.execute("INSERT INTO Sesion (idSesion,idUsuario,expiraUnix) VALUES (?,1,?)", [sesion.idSesion, sesion.exp]);
        servidor = require("../src/app").listen(0, "127.0.0.1");
        await new Promise((r, e) => { servidor.once("listening", r); servidor.once("error", e); });
        const [[{ hoy, inicio }]] = await db.query(
            "SELECT CAST(CURDATE() AS CHAR) hoy, CAST(DATE_SUB(CURDATE(), INTERVAL 365 DAY) AS CHAR) inicio"
        );
        const pag = modo === "despues" ? "?limite=50" : "";
        const rutas = { movimientos: "/ingresos" + pag, egresos: "/egresos" + pag, facturas: "/facturas" + pag,
            mensajes: "/mensajes/2" + pag, notificaciones: "/notificaciones" + pag, historial: "/historial" + pag,
            pendientes: "/notificaciones/pendientes", contactos: "/mensajes/contactos", presupuestos: "/presupuestos",
            dashboard: "/dashboard", analisis: "/analisis", reportes: `/reportes?desde=${inicio}&hasta=${hoy}` };
        if (modo === "despues") rutas.sondeo = "/mensajes/2?limite=50&despues=" + n;
        else rutas.sondeo = rutas.mensajes;
        const salida = { esquema, n, modo, metricas: {}, planes: {}, financiera: {} };
        async function medir(ruta) {
            const inicioMedicion = performance.now();
            const respuesta = await fetch(`http://127.0.0.1:${servidor.address().port}/api${ruta}`, {
                headers: { Authorization: "Bearer " + sesion.token }
            });
            const cuerpo = await respuesta.text();
            if (!respuesta.ok) throw new Error(`${ruta}: ${respuesta.status}`);
            return { ms: performance.now() - inicioMedicion, bytes: Buffer.byteLength(cuerpo), cuerpo };
        }
        for (const [nombre, ruta] of Object.entries(rutas)) {
            await medir(ruta);
            consultas.length = 0;
            const primera = await medir(ruta);
            const capturadas = consultas.slice();
            const muestras = [primera.ms];
            for (let i = 0; i < 6; i++) muestras.push((await medir(ruta)).ms);
            muestras.sort((a, b) => a - b);
            salida.metricas[nombre] = { medianaMs: +muestras[3].toFixed(2), maxMs: +muestras[6].toFixed(2),
                consultas: capturadas.length, bytes: primera.bytes };
            if (["dashboard", "reportes", "analisis", "presupuestos", "facturas"].includes(nombre)) {
                const datos = JSON.parse(primera.cuerpo);
                salida.financiera[nombre] = ["reportes", "analisis"].includes(nombre) ? datos.totales
                    : nombre === "dashboard" ? [datos.ingresos, datos.egresos, datos.balance]
                        : nombre === "facturas" ? datos.resumen : datos.map(p => [p.idPresupuesto, p.ejecutado]);
            }
            if (n === 10000) {
                salida.planes[nombre] = [];
                for (const { sql, params } of capturadas.slice(1)) {
                    if (!/^\s*(?:\(?SELECT|WITH)/i.test(sql)) continue;
                    const [plan] = await db.query("EXPLAIN " + sql, params);
                    const resumen = plan.map(p => ({ tabla: p.table ?? p.Table, tipo: p.type ?? p.Type,
                        clave: p.key ?? p.Key, filas: p.rows ?? p.Rows, extra: p.Extra ?? p.extra }));
                    let real;
                    try { [real] = await db.query("EXPLAIN ANALYZE " + sql, params); } catch { /* Motor sin soporte. */ }
                    salida.planes[nombre].push({ resumen, real: real?.map(p => Object.values(p)[0]) });
                }
            }
        }
        const cpu = process.cpuUsage();
        const inicioConcurrente = performance.now();
        await Promise.all(Array.from({ length: 8 }, () => medir(rutas.movimientos)));
        salida.concurrente = { peticiones: 8, ms: +(performance.now() - inicioConcurrente).toFixed(2),
            cpuUsuarioMs: +(process.cpuUsage(cpu).user / 1000).toFixed(2), rssMb: +(process.memoryUsage().rss / 1048576).toFixed(1) };
        if (modo === "despues") {
            assert.deepEqual(salida.financiera, JSON.parse(readFileSync(archivo, "utf8")).financiera,
                "Los resultados financieros deben coincidir con la línea base");
        }
        writeFileSync(modo === "antes" ? archivo : archivo.replace(/\.json$/, "-despues.json"), JSON.stringify(salida, null, 2));
        console.log(`${modo} ${n} ${esquema}`);
    } finally {
        if (servidor) await new Promise(r => servidor.close(r));
        await pool?.end();
        await db.end();
    }
}

if (require.main === module) {
    principal().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
}

module.exports = { ejecutarSql, sembrar };
