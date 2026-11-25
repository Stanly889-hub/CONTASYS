const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const { opcionesCors } = require("../src/config/cors");
const { minutosDeBloqueo, registrarFallo } = require("../src/middleware/limitarLogin");
const migracionesProteccion = ["MIGRACION_PROTEGER_USUARIOS.sql", "MIGRACION_PROTEGER_VINCULOS.sql"];
const migracionesFase4 = ["MIGRACION_ALERTAS_PRESUPUESTO.sql", "MIGRACION_TIPO_CATEGORIA.sql"];
const migracionFacturas = "MIGRACION_FACTURACION.sql";
const migracionConciliacion = "MIGRACION_FACTURAS_CONCILIACION.sql";
const migracionCorrecciones = "MIGRACION_CORRECCION_PAGOS.sql";

async function ejecutarSql(conexion, archivo) {
    const sql = readFileSync(resolve(__dirname, "../../database", archivo), "utf8");
    let delimitador = ";";
    let sentencia = "";
    let resultado;
    for (const linea of sql.split(/\r?\n/)) {
        const contenido = linea.trim();
        if (!contenido || contenido.startsWith("--")) continue;
        if (contenido.startsWith("DELIMITER ")) {
            assert.equal(sentencia, "");
            delimitador = contenido.slice("DELIMITER ".length);
            continue;
        }
        assert.doesNotMatch(contenido, /^(USE|DROP|TRUNCATE|CREATE\s+DATABASE)\b/i);
        sentencia += linea + "\n";
        if (contenido.endsWith(delimitador)) {
            [resultado] = await conexion.query(sentencia.trimEnd().slice(0, -delimitador.length));
            sentencia = "";
        }
    }
    assert.equal(sentencia, "");
    return resultado;
}

async function abrirBaseAislada(t, etiqueta) {
    require("dotenv").config({ quiet: true, path: resolve(__dirname, "../.env") });
    const nombreDb = `contasys_prueba_${etiqueta}_${randomBytes(6).toString("hex")}`;
    const conexion = await mysql.createConnection({
        host: process.env.DB_HOST, port: process.env.DB_PORT,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD
    });
    t.after(() => conexion.end());
    await conexion.query(`CREATE DATABASE \`${nombreDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conexion.changeUser({ database: nombreDb });
    t.diagnostic(`Base aislada: ${nombreDb}`);
    return { conexion, nombreDb };
}

test("CORS limita los orígenes según el entorno", () => {
    const permitido = (config, origen) => {
        let resultado;
        opcionesCors(config).origin(origen, (error, valor) => {
            assert.ifError(error);
            resultado = valor;
        });
        return resultado;
    };
    assert.equal(permitido({}, "http://localhost:5500"), true);
    assert.equal(permitido({}, "http://127.0.0.1:5500"), true);
    assert.equal(permitido({}, "https://otro.example"), false);
    const config = { NODE_ENV: "production", CORS_ORIGIN: "https://app.example, https://admin.example" };
    assert.equal(permitido(config, "https://app.example"), true);
    assert.equal(permitido(config, "https://admin.example"), true);
    assert.equal(permitido(config, "http://localhost:5500"), false);
    assert.equal(permitido({ NODE_ENV: "production" }, "https://otro.example"), false);
    assert.throws(() => opcionesCors({ NODE_ENV: "production", CORS_ORIGIN: "*" }));
    assert.throws(() => opcionesCors({ NODE_ENV: "production", CORS_ORIGIN: "http://localhost:5500" }));
});

test("el limitador tiene tope y libera claves caducadas", t => {
    let ahora = Date.now();
    t.mock.method(Date, "now", () => ahora);
    const peticion = i => ({ ip: "127.0.0.1", body: { correo: `prueba${i}@example.invalid` } });
    for (let i = 0; i < 5; i++) registrarFallo(peticion(0));
    assert.equal(minutosDeBloqueo(peticion(0)), 15);
    for (let i = 1; i <= 10000; i++) registrarFallo(peticion(i));
    assert.equal(minutosDeBloqueo(peticion(10000)), 1);
    ahora += 15 * 60 * 1000;
    assert.equal(minutosDeBloqueo(peticion(0)), 0);
    for (let i = 1; i < 10000; i++) assert.equal(minutosDeBloqueo(peticion(i)), 0);
});

test("regresión de autenticación con HTTP y MySQL independientes", {
    skip: process.env.CONTASYS_PRUEBA_MYSQL !== "1",
    timeout: 45000
}, async t => {
    const { conexion, nombreDb } = await abrirBaseAislada(t, "auth");
    await ejecutarSql(conexion, "CONTASYS_PRODUCCION.sql");
    process.env.DB_NAME = nombreDb;
    process.env.JWT_SECRET = randomBytes(32).toString("hex");
    process.env.NODE_ENV = "development";
    process.env.CORS_ORIGIN = "";
    const pool = require("../src/config/db");
    let poolCerrado = false;
    t.after(() => poolCerrado ? undefined : pool.end());
    const app = require("../src/app");
    const { crearPrimerAdministrador } = require("../scripts/crear-primer-administrador");
    const servidor = await new Promise((aceptar, rechazar) => {
        const instancia = app.listen(0, "127.0.0.1", () => aceptar(instancia));
        instancia.once("error", rechazar);
    });
    t.after(() => new Promise(aceptar => servidor.close(aceptar)));
    const pedir = (ruta, { token, datos, method = "GET", origen } = {}) => fetch(
        `http://127.0.0.1:${servidor.address().port}/api${ruta}`, {
            method,
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
                ...(datos && { "Content-Type": "application/json" }),
                ...(origen && { Origin: origen })
            },
            body: datos && JSON.stringify(datos)
        }
    );
    const saludIncompleta = await pedir("/salud");
    assert.equal(saludIncompleta.status, 503);
    assert.deepEqual(await saludIncompleta.json(), {
        estado: "no_disponible", mensaje: "Servicio temporalmente no disponible"
    });
    for (const archivo of ["MIGRACION_ROLES_PREMIUM.sql", "MIGRACION_SESIONES.sql"]) {
        await ejecutarSql(conexion, archivo);
        await ejecutarSql(conexion, archivo);
    }
    for (const archivo of migracionesProteccion) await ejecutarSql(conexion, archivo);
    for (const archivo of migracionesFase4) await ejecutarSql(conexion, archivo);
    await ejecutarSql(conexion, migracionFacturas);
    await ejecutarSql(conexion, migracionFacturas);
    await ejecutarSql(conexion, migracionConciliacion);
    await ejecutarSql(conexion, migracionCorrecciones);
    const diagnosticoPrevio = await ejecutarSql(conexion, "DIAGNOSTICO_MIGRACIONES.sql");
    assert.equal(diagnosticoPrevio.filter(c => c.migracion === "Rendimiento" && c.resultado === "Revisar").length, 9);
    await ejecutarSql(conexion, "MIGRACION_RENDIMIENTO.sql");
    assert.ok((await ejecutarSql(conexion, "DIAGNOSTICO_MIGRACIONES.sql")).every(c => c.resultado === "Compatible"));
    assert.equal(await pedir("/salud").then(r => r.status), 200);
    const ficha = i => ({
        documento: String(i), nombre: "Prueba", apellido: "Aislada",
        correo: `seguridad${i}@example.invalid`, password: "PruebaAislada5938"
    });
    const login = async i => {
        const respuesta = await pedir("/auth/login", { method: "POST", datos: ficha(i) });
        assert.equal(respuesta.status, 200);
        return (await respuesta.json()).token;
    };
    for (const rol of ["Administrador", "administrador", "ADMINISTRADOR", "Administrador ", "Administradór"]) {
        const respuesta = await pedir("/auth/registro", { method: "POST", datos: { ...ficha(1), rol } });
        assert.equal(respuesta.status, 403, rol);
    }
    const altas = await Promise.allSettled([crearPrimerAdministrador(ficha(1)), crearPrimerAdministrador(ficha(3))]);
    assert.equal(altas.filter(respuesta => respuesta.status === "fulfilled").length, 1);
    const admin = await login(altas[0].status === "fulfilled" ? 1 : 3);
    assert.equal(await pedir("/auth/registro", {
        method: "POST", datos: { ...ficha(2), rol: "Contador" }
    }).then(r => r.status), 201);
    const altaCliente = await pedir("/auth/registro", {
        method: "POST", datos: { ...ficha(4), rol: "Emprendedor" }
    });
    assert.equal(altaCliente.status, 201);
    const cliente = await altaCliente.json();
    const usuario = await login(2);
    const otraSesion = await login(2);
    const actual = await pedir("/auth/sesion", { token: usuario }).then(r => r.json());
    const finanzasCliente = `/analisis?clienteId=${cliente.idUsuario}`;
    assert.equal(await pedir(finanzasCliente, { token: usuario }).then(r => r.status), 403);
    await conexion.execute(
        "INSERT INTO ClienteContador (idContador, idCliente, estado) VALUES (?, ?, 'Aceptado')",
        [actual.idUsuario, cliente.idUsuario]
    );
    assert.equal(await pedir(finanzasCliente, { token: usuario }).then(r => r.status), 200);
    assert.equal(await pedir(finanzasCliente, { token: usuario, method: "POST" }).then(r => r.status), 403);
    const ruta = `/usuarios/${actual.idUsuario}`;
    const actualizar = (campo, valor) => pedir(`${ruta}/${campo}`, {
        token: admin, method: "PUT", datos: { [campo]: valor }
    }).then(r => r.status);
    const permiso = token => pedir("/usuarios", { token }).then(r => r.status);
    assert.equal(await permiso(usuario), 403);
    assert.equal(await actualizar("rol", "administrador"), 400);
    assert.equal(await actualizar("rol", "Administrador"), 200);
    assert.equal(await permiso(usuario), 200);
    assert.equal(await pedir(finanzasCliente, { token: usuario }).then(r => r.status), 403);
    assert.equal(await actualizar("rol", "Emprendedor"), 200);
    assert.equal(await permiso(usuario), 403);
    assert.equal(await pedir("/auth/logout", { method: "POST", token: usuario }).then(r => r.status), 204);
    assert.equal(await permiso(usuario), 401);
    assert.equal(await pedir("/auth/sesion", { token: otraSesion }).then(r => r.status), 200);
    assert.equal(await actualizar("estado", "Inactivo"), 200);
    assert.equal(await permiso(otraSesion), 401);
    assert.equal(await actualizar("estado", "Activo"), 200);
    assert.equal(await permiso(otraSesion), 401);
    assert.equal(await permiso(await login(2)), 403);
    const anterior = jwt.sign({ idUsuario: actual.idUsuario, rol: "Administrador" }, process.env.JWT_SECRET);
    assert.equal(await permiso(anterior), 401);
    const expirada = await login(2);
    await conexion.execute("UPDATE Sesion SET expiraUnix = UNIX_TIMESTAMP() WHERE idSesion = ?", [jwt.decode(expirada).jti]);
    assert.equal(await permiso(expirada), 401);
    const [actividad] = await conexion.execute("SELECT accion FROM HistorialActividad WHERE modulo = 'Usuarios'");
    assert.equal(actividad.filter(fila => fila.accion.startsWith("Cambio de rol")).length, 2);
    assert.equal(actividad.filter(fila => fila.accion.startsWith("Estado del usuario")).length, 2);
    const preflight = await pedir("/auth/logout", { method: "OPTIONS", origen: "http://localhost:5500" });
    assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5500");
    const origenAjeno = await pedir("/salud", { origen: "https://otro.example" });
    assert.equal(origenAjeno.headers.get("access-control-allow-origin"), null);
    for (let i = 0; i < 5; i++) {
        assert.equal(await pedir("/auth/login", { method: "POST", datos: ficha(99) }).then(r => r.status), 401);
    }
    const bloqueada = await pedir("/auth/login", { method: "POST", datos: ficha(99) });
    assert.equal(bloqueada.status, 429);
    assert.ok(Number(bloqueada.headers.get("retry-after")) > 0);

    await t.test("rollback del registro, recuperación y restricciones SQL", async () => {
        const rechazado = (sql, valores, codigo) => assert.rejects(conexion.execute(sql, valores), { code: codigo });
        await conexion.query(`CREATE TRIGGER Prueba_FalloSuscripcion BEFORE INSERT ON Suscripcion
            FOR EACH ROW BEGIN
                IF EXISTS (SELECT 1 FROM Usuario WHERE idUsuario = NEW.idUsuario AND documento = '5') THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fallo de prueba';
                END IF;
            END`);
        const fallo = await pedir("/auth/registro", {
            method: "POST", datos: { ...ficha(5), rol: "Emprendedor" }
        });
        assert.equal(fallo.status, 500);
        assert.equal((await conexion.query("SELECT idUsuario FROM Usuario WHERE documento = '5'"))[0].length, 0);

        const [sinPlan] = await conexion.execute(
            `INSERT INTO Usuario (documento, nombre, apellido, correo, password_hash, fechaRegistro, idRol)
             VALUES ('6', 'Prueba', 'Aislada', 'sinplan@example.invalid', 'demo', CURDATE(), 3)`
        );
        await conexion.execute("UPDATE Suscripcion SET tipoPlan = 'Premium', estado = 'Cancelada' WHERE idUsuario = ?", [cliente.idUsuario]);
        const [previo] = await conexion.execute("SELECT * FROM Suscripcion WHERE idUsuario <> ?", [sinPlan.insertId]);
        await ejecutarSql(conexion, "DIAGNOSTICO_INTEGRIDAD.sql");
        await ejecutarSql(conexion, "RECUPERAR_SUSCRIPCIONES.sql");
        await ejecutarSql(conexion, "RECUPERAR_SUSCRIPCIONES.sql");
        const [posterior] = await conexion.execute("SELECT * FROM Suscripcion WHERE idUsuario <> ?", [sinPlan.insertId]);
        assert.deepEqual(posterior, previo);
        const [[recuperada]] = await conexion.execute("SELECT tipoPlan, estado FROM Suscripcion WHERE idUsuario = ?", [sinPlan.insertId]);
        assert.deepEqual(recuperada, { tipoPlan: "Free", estado: "Activa" });

        const movimiento = tabla => `INSERT INTO ${tabla} (monto, descripcion, fecha, idUsuario, idCategoria, idMetodoPago)
            VALUES (?, 'Prueba', CURDATE(), ?, ?, ?)`;
        await rechazado(movimiento("Ingreso"), [100, cliente.idUsuario, 4, 1], "ER_SIGNAL_EXCEPTION");
        await rechazado(movimiento("Egreso"), [100, cliente.idUsuario, 1, 1], "ER_SIGNAL_EXCEPTION");
        await rechazado(movimiento("Ingreso"), [0, cliente.idUsuario, 1, 1], "ER_CHECK_CONSTRAINT_VIOLATED");
        await rechazado(movimiento("Egreso"), [100, cliente.idUsuario, 4, 99999], "ER_NO_REFERENCED_ROW_2");
        const [egreso] = await conexion.execute(movimiento("Egreso"), [100, cliente.idUsuario, 4, 1]);
        await rechazado("UPDATE Egreso SET idCategoria = 1 WHERE idEgreso = ?", [egreso.insertId], "ER_SIGNAL_EXCEPTION");
        await rechazado(
            `INSERT INTO Presupuesto (nombrePresupuesto, montoPresupuesto, fechaInicio, fechaFin, idUsuario, idCategoria)
             VALUES ('Prueba', 100, '2026-02-02', '2026-02-01', ?, 4)`, [cliente.idUsuario], "ER_CHECK_CONSTRAINT_VIOLATED"
        );
        await rechazado("INSERT INTO MetodoPago (nombreMetodo) VALUES ('Efectivo')", [], "ER_DUP_ENTRY");
        await rechazado(
            "INSERT INTO CategoriaFinanciera (codigoCategoria, nombreCategoria, tipo) VALUES ('PRUEBA', 'Ventas', 'Ingreso')",
            [], "ER_DUP_ENTRY"
        );
        await rechazado("INSERT INTO Mensaje (contenido, idEmisor, idReceptor) VALUES ('Prueba', ?, ?)",
            [cliente.idUsuario, cliente.idUsuario], "ER_SIGNAL_EXCEPTION");
        await rechazado("INSERT INTO ClienteContador (idContador, idCliente) VALUES (?, ?)",
            [actual.idUsuario, cliente.idUsuario], "ER_DUP_ENTRY");
        await rechazado("INSERT INTO ClienteContador (idContador, idCliente) VALUES (99999, ?)",
            [cliente.idUsuario], "ER_NO_REFERENCED_ROW_2");
    });

    await t.test("retención de sesiones por lote sin modificar auditoría", async () => {
        const { retenerSesiones } = require("../scripts/retener-sesiones");
        const filas = Array.from({ length: 201 }, () => [randomBytes(18).toString("hex"), cliente.idUsuario, 1]);
        await conexion.query("INSERT INTO Sesion (idSesion, idUsuario, expiraUnix) VALUES ?", [filas]);
        const [auditoria] = await conexion.query("SELECT * FROM HistorialActividad ORDER BY idHistorial");
        assert.deepEqual(await retenerSesiones(pool, false), { elegibles: 201, maximoPorLote: 200 });
        assert.deepEqual(await retenerSesiones(pool, true), { sesionesDepuradas: 200 });
        assert.deepEqual(await retenerSesiones(pool, false), { elegibles: 1, maximoPorLote: 200 });
        assert.equal((await conexion.query("SELECT COUNT(*) AS total FROM Sesion WHERE expiraUnix > 1"))[0][0].total > 0, true);
        assert.deepEqual((await conexion.query("SELECT * FROM HistorialActividad ORDER BY idHistorial"))[0], auditoria);
    });

    await t.test("protección de cuentas, vínculos y nueva autorización", async () => {
        const cambiar = (id, campo, valor) => pedir(`/usuarios/${id}/${campo}`, {
            method: "PUT", token: admin, datos: { [campo]: valor }
        }).then(r => r.status);
        const [[vinculo]] = await conexion.execute(
            "SELECT idVinculo, estado FROM ClienteContador WHERE idContador = ? AND idCliente = ?",
            [actual.idUsuario, cliente.idUsuario]
        );
        assert.equal(vinculo.estado, "Suspendido");
        const estadoDelVinculo = async () => (await conexion.execute(
            "SELECT estado FROM ClienteContador WHERE idVinculo = ?", [vinculo.idVinculo]
        ))[0][0].estado;
        const tablas = ["Usuario", "Ingreso", "Egreso", "Presupuesto", "Mensaje", "Suscripcion", "ClienteContador"];
        const datos = () => Promise.all(tablas.map(tabla => conexion.query(`SELECT * FROM ${tabla}`)
            .then(([filas]) => filas.map(({ updated_at, ...datosGuardados }) => datosGuardados))));
        await conexion.execute("INSERT INTO Mensaje (contenido, idEmisor, idReceptor) VALUES ('Conservar', ?, ?)", [actual.idUsuario, cliente.idUsuario]);
        assert.equal(await cambiar(actual.idUsuario, "rol", "Contador"), 200);
        const contador = await login(2);
        let emprendedor = await login(4);
        const consultar = () => pedir(finanzasCliente, { token: contador }).then(r => r.status);
        const solicitar = (correo = ficha(4).correo) => pedir("/vinculos", {
            method: "POST", token: contador, datos: { correoCliente: correo }
        }).then(r => r.status);
        const responder = () => pedir(`/vinculos/${vinculo.idVinculo}/responder`, {
            method: "PUT", token: emprendedor, datos: { aceptar: true }
        }).then(r => r.status);
        assert.equal(await consultar(), 403);
        assert.equal(await responder(), 400);
        assert.deepEqual((await Promise.all([solicitar(), solicitar()])).sort(), [201, 409]);
        assert.equal(await consultar(), 403);
        assert.equal(await responder(), 200);
        assert.equal(await consultar(), 200);

        const antes = await datos();
        assert.equal(await cambiar(cliente.idUsuario, "estado", "Inactivo"), 200);
        assert.equal(await consultar(), 403);
        assert.equal(await cambiar(cliente.idUsuario, "estado", "Activo"), 200);
        assert.equal(await consultar(), 200);
        assert.deepEqual(await datos(), antes);
        assert.equal(await cambiar(actual.idUsuario, "estado", "Inactivo"), 200);
        assert.equal(await consultar(), 401);
        assert.equal(await cambiar(actual.idUsuario, "estado", "Activo"), 200);
        assert.deepEqual(await datos(), antes);

        // La protección también cubre un cambio de rol realizado directamente en SQL.
        await conexion.execute("UPDATE Usuario SET idRol = 2 WHERE idUsuario = ?", [cliente.idUsuario]);
        await conexion.execute("UPDATE Usuario SET idRol = 3 WHERE idUsuario = ?", [cliente.idUsuario]);
        assert.equal(await estadoDelVinculo(), "Suspendido");
        emprendedor = await login(4);
        assert.equal(await responder(), 400);
        const renovado = await login(2);
        assert.equal(await pedir(finanzasCliente, { token: renovado }).then(r => r.status), 403);
        assert.equal(await pedir(`/vinculos/${vinculo.idVinculo}`, { method: "DELETE", token: emprendedor }).then(r => r.status), 200);
        assert.equal(await estadoDelVinculo(), "Revocado");
        const solicitarConSesionNueva = correo => pedir("/vinculos", {
            method: "POST", token: renovado, datos: { correoCliente: correo }
        }).then(r => r.status);
        for (const i of [7, 8, 9]) {
            assert.equal(await pedir("/auth/registro", {
                method: "POST", datos: { ...ficha(i), rol: "Emprendedor" }
            }).then(r => r.status), 201);
        }
        assert.deepEqual((await Promise.all([7, 8, 9].map(i => solicitarConSesionNueva(ficha(i).correo)))).sort(), [201, 201, 403]);
        assert.equal(await pedir("/suscripcion", {
            method: "PUT", token: renovado, datos: { tipoPlan: "Premium" }
        }).then(r => r.status), 200);
        assert.equal(await solicitarConSesionNueva(ficha(4).correo), 201);

        const [reglas] = await conexion.query(`SELECT DELETE_RULE
            FROM information_schema.REFERENTIAL_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'Usuario'`);
        assert.equal(reglas.length, 14);
        assert.ok(reglas.every(regla => ["RESTRICT", "NO ACTION"].includes(regla.DELETE_RULE)));
        // Se prueba en una transacción que siempre se revierte en el esquema aislado.
        await conexion.beginTransaction();
        try {
            await assert.rejects(conexion.execute("DELETE FROM Usuario WHERE idUsuario = ?", [cliente.idUsuario]),
                { code: "ER_ROW_IS_REFERENCED_2" });
        } finally {
            await conexion.rollback();
        }
        const [eventos] = await conexion.execute(
            "SELECT idUsuario FROM HistorialActividad WHERE accion = ?",
            [`Vínculo ${vinculo.idVinculo} suspendido por cambio de rol`]
        );
        assert.equal(eventos.filter(evento => evento.idUsuario === actual.idUsuario).length, 2);
        assert.equal(eventos.filter(evento => evento.idUsuario === cliente.idUsuario).length, 2);
    });

    await t.test("exactitud financiera, catálogos, presupuestos y aislamiento", async () => {
        const [[fechas]] = await conexion.query(
            `SELECT CAST(CURDATE() AS CHAR) AS hoy,
                    CAST(DATE_ADD(CURDATE(), INTERVAL 1 DAY) AS CHAR) AS futuro,
                    CAST(DATE_SUB(CURDATE(), INTERVAL 4 MONTH) AS CHAR) AS anterior`
        );
        const { hoy, futuro, anterior } = fechas;
        for (const [i, rol] of [[20, "Emprendedor"], [21, "Emprendedor"], [22, "Contador"], [23, "Emprendedor"]]) {
            assert.equal(await pedir("/auth/registro", {
                method: "POST", datos: { ...ficha(i), rol }
            }).then(r => r.status), 201);
        }
        const titular = await login(20);
        const ajeno = await login(21);
        const contador = await login(22);
        const vacio = await login(23);
        const idDe = token => pedir("/auth/sesion", { token }).then(r => r.json()).then(u => u.idUsuario);
        const idTitular = await idDe(titular);
        const idAjeno = await idDe(ajeno);
        const idContador = await idDe(contador);
        const leer = async (ruta, token = titular) => {
            const r = await pedir(ruta, { token });
            assert.equal(r.status, 200, ruta);
            return r.json();
        };
        const escribir = (ruta, datos, token = titular, method = "POST") => pedir(ruta, { token, datos, method });
        const movimiento = (monto, opciones = {}) => ({
            monto, fecha: hoy, idCategoria: 1, idMetodoPago: 1, descripcion: "Prueba de Fase 3", ...opciones
        });
        const alta = async (ruta, datos, token = titular) => {
            const r = await escribir(ruta, datos, token);
            assert.equal(r.status, 201, ruta);
            return (await r.json()).id;
        };
        const valores = (ingresos, egresos, balance) => ({ ingresos, egresos, balance });
        const ceros = valores("0.00", "0.00", "0.00");
        assert.deepEqual((await leer("/analisis", vacio)).totales, { ...ceros, tasaAhorro: 0 });
        assert.deepEqual((await leer(`/reportes?desde=${anterior}&hasta=${anterior}`, vacio)).detalle, []);
        assert.deepEqual((await leer("/dashboard", vacio)).pendientes, ceros);
        const editado = await alta("/ingresos", movimiento("0.10", { numeroComprobante: "REF" }));
        await alta("/ingresos", movimiento("0.20"));
        await alta("/ingresos", movimiento("12.34", { estadoTransaccion: "Pendiente" }));
        await alta("/ingresos", movimiento("9999999999.99", { estadoTransaccion: "Anulada" }));
        await alta("/egresos", movimiento("0.40", { idCategoria: 4 }));
        await alta("/egresos", movimiento("7.89", { idCategoria: 4, estadoTransaccion: "Pendiente" }));
        await alta("/egresos", movimiento("10.00", { idCategoria: 4, estadoTransaccion: "Anulada" }));
        await alta("/ingresos", movimiento("17.00"), ajeno);
        await alta("/ingresos", movimiento("99.00"), contador);
        const rutaReporte = `/reportes?desde=${hoy}&hasta=${hoy}`;
        const esperado = valores("0.30", "0.40", "-0.10");
        const pendientes = valores("12.34", "7.89", "4.45");
        const reporte = await leer(rutaReporte);
        assert.deepEqual(reporte.totales, esperado);
        assert.deepEqual(reporte.pendientes, pendientes);
        assert.deepEqual(reporte.gastosPorCategoria, { Arriendo: "0.40" });
        assert.equal(reporte.detalle.filter(m => m.estadoTransaccion === "Anulada").length, 2);
        const analisis = await leer("/analisis");
        assert.deepEqual(analisis.totales, { ...esperado, tasaAhorro: -33 });
        assert.deepEqual(analisis.pendientes, pendientes);
        assert.deepEqual(analisis.tendenciaMensual, [{ mes: hoy.slice(0, 7), ...esperado }]);
        const tablero = await leer("/dashboard");
        assert.deepEqual(valores(tablero.ingresos, tablero.egresos, tablero.balance), esperado);
        assert.deepEqual(tablero.pendientes, pendientes);
        const [[vista]] = await conexion.execute("SELECT balance FROM vw_balance_por_usuario WHERE idUsuario = ?", [idTitular]);
        assert.equal(vista.balance, tablero.balance);

        for (const datos of [
            movimiento("0.00"), movimiento("10000000000.00"), movimiento("1.001"), movimiento("1e3"),
            movimiento("1", { fecha: "2025-02-29" }), movimiento("1", { estadoTransaccion: "Invalida" }),
            movimiento("1", { idCategoria: 4 }), movimiento("1", { idMetodoPago: 99999 }),
            movimiento("1", { descripcion: " " }), movimiento("1", { numeroComprobante: "x".repeat(101) }),
            movimiento("1", { descripcion: "é".repeat(32768) })
        ]) {
            assert.equal((await escribir("/ingresos", datos)).status, 400);
            assert.equal((await escribir(`/ingresos/${editado}`, datos, titular, "PUT")).status, 400);
        }
        assert.equal((await pedir("/reportes?desde=2026-02-30&hasta=2026-03-01", { token: titular })).status, 400);
        assert.equal((await pedir(`/reportes?desde=${futuro}&hasta=${hoy}`, { token: titular })).status, 400);
        assert.equal((await pedir(`/ingresos?fechaDesde=${futuro}&fechaHasta=${hoy}`, { token: titular })).status, 400);
        assert.equal((await escribir(`/ingresos/${editado}`, movimiento("1"), ajeno, "PUT")).status, 404);
        assert.equal((await pedir(`/ingresos/${editado}`, { token: ajeno, method: "DELETE" })).status, 404);
        assert.equal((await leer("/ingresos", ajeno)).length, 1);

        await conexion.query("UPDATE CategoriaFinanciera SET estado = 'Inactiva' WHERE idCategoria = 1");
        await conexion.query("UPDATE MetodoPago SET estado = 'Inactivo' WHERE idMetodoPago = 1");
        assert.equal((await escribir("/ingresos", movimiento("1", { idMetodoPago: 2 }))).status, 400);
        assert.equal((await escribir("/ingresos", movimiento("1", { idCategoria: 2 }))).status, 400);
        assert.equal((await escribir(`/ingresos/${editado}`, movimiento("0.30"), titular, "PUT")).status, 200);
        assert.equal((await leer(`/ingresos?idCategoria=1&fechaDesde=${hoy}&fechaHasta=${hoy}`)).find(m => m.id === editado).numeroComprobante, "REF");
        assert.equal((await leer("/dashboard")).balance, "0.10");
        await conexion.query("UPDATE CategoriaFinanciera SET estado = 'Activa' WHERE idCategoria = 1");
        await conexion.query("UPDATE MetodoPago SET estado = 'Activo' WHERE idMetodoPago = 1");
        const descartable = await alta("/ingresos", movimiento("0.01"));
        assert.equal((await leer("/dashboard")).balance, "0.11");
        assert.equal((await pedir(`/ingresos/${descartable}`, { token: titular, method: "DELETE" })).status, 200);
        assert.equal((await leer("/dashboard")).balance, "0.10");

        const presupuesto = (nombre, monto, idCategoria, opciones = {}) => ({
            nombrePresupuesto: nombre, montoPresupuesto: monto, idCategoria, fechaInicio: hoy, fechaFin: hoy, ...opciones
        });
        const meta = await alta("/presupuestos", presupuesto("Meta de ventas", "0.50", 1));
        await alta("/presupuestos", presupuesto("Límite de arriendo", "0.25", 4));
        await alta("/presupuestos", presupuesto("Sin ejecución", "1.00", 5));
        assert.equal((await escribir("/presupuestos", presupuesto("Cuarto", "1.00", 2))).status, 403);
        assert.equal((await escribir(`/presupuestos/${meta}`, presupuesto("Inválido", "1.00", 1, { fechaInicio: futuro }), titular, "PUT")).status, 400);
        assert.equal((await escribir(`/presupuestos/${meta}`, presupuesto("Inválido", "1.00", 1, { estado: "Inválido" }), titular, "PUT")).status, 400);
        assert.equal((await escribir(`/presupuestos/${meta}`, presupuesto("Ajeno", "1.00", 1), ajeno, "PUT")).status, 404);
        const activarPremium = async token => assert.equal((await escribir("/suscripcion", { tipoPlan: "Premium" }, token, "PUT")).status, 200);
        await activarPremium(titular);
        await alta("/presupuestos", presupuesto("Meta preventiva", "0.60", 1));

        await conexion.execute("INSERT INTO ClienteContador (idContador, idCliente, estado) VALUES (?, ?, 'Aceptado')", [idContador, idTitular]);
        const sufijo = `?clienteId=${idTitular}`;
        const [notificacionesAntes] = await conexion.execute("SELECT * FROM Notificacion WHERE idUsuario = ?", [idTitular]);
        const presupuestos = await leer(`/presupuestos${sufijo}`, contador);
        const [notificacionesDespues] = await conexion.execute("SELECT * FROM Notificacion WHERE idUsuario = ?", [idTitular]);
        assert.deepEqual(notificacionesDespues, notificacionesAntes);
        const extraer = nombre => {
            const p = presupuestos.find(fila => fila.nombrePresupuesto === nombre);
            return [p.tipo, p.ejecutado, p.disponible, p.porcentaje, p.excedido, p.alertaPreventiva];
        };
        assert.deepEqual(extraer("Meta de ventas"), ["Ingreso", "0.50", "0.00", 100, false, false]);
        assert.deepEqual(extraer("Límite de arriendo"), ["Egreso", "0.40", "-0.15", 160, true, false]);
        assert.deepEqual(extraer("Sin ejecución"), ["Egreso", "0.00", "1.00", 0, false, false]);
        assert.deepEqual(extraer("Meta preventiva"), ["Ingreso", "0.50", "0.10", 83, false, true]);
        assert.equal((await leer(`/dashboard${sufijo}`, contador)).ingresos, "0.50");
        assert.equal((await leer(`${rutaReporte}&clienteId=${idTitular}`, contador)).totales.ingresos, "0.50");
        assert.equal((await pedir(`/dashboard?clienteId=${idAjeno}`, { token: contador })).status, 403);
        assert.equal((await escribir(`/ingresos${sufijo}`, movimiento("1"), contador)).status, 403);
        assert.equal((await escribir(`/presupuestos/${meta}${sufijo}`, presupuesto("Ajeno", "1", 1), contador, "PUT")).status, 403);

        await alta("/ingresos", movimiento("1.20", { fecha: anterior }));
        await alta("/ingresos", movimiento("9999999999.99", { fecha: futuro }));
        const [free, premium] = await Promise.all([leer(`/analisis${sufijo}`, contador), leer("/analisis")]);
        assert.equal(free.plan, "Free");
        assert.equal(free.totales.ingresos, "0.50");
        assert.equal(free.hasta, hoy);
        assert.equal(free.desde.slice(-3), "-01");
        assert.equal(premium.plan, "Premium");
        assert.equal(premium.totales.ingresos, "1.70");
        assert.deepEqual((await leer(`/reportes?desde=${anterior}&hasta=${hoy}`)).totales, valores("1.70", "0.40", "1.30"));
        assert.equal((await leer(`/reportes?desde=${futuro}&hasta=${futuro}`)).totales.ingresos, "9999999999.99");
    });

    await t.test("cupos, alertas transaccionales y notificaciones privadas", async () => {
        const [[{ hoy, ayer, manana }]] = await conexion.query(
            `SELECT CAST(CURDATE() AS CHAR) AS hoy,
                    CAST(DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS CHAR) AS ayer,
                    CAST(DATE_ADD(CURDATE(), INTERVAL 1 DAY) AS CHAR) AS manana`
        );
        for (const [i, rol] of [[30, "Emprendedor"], [31, "Contador"], [32, "Emprendedor"]]) {
            assert.equal(await pedir("/auth/registro", {
                method: "POST", datos: { ...ficha(i), rol }
            }).then(r => r.status), 201);
        }
        const titular = await login(30);
        const contador = await login(31);
        const otroCliente = await login(32);
        const cambiar = (ruta, method, datos, token = titular) => pedir(ruta, { token, method, datos });
        const leer = async (ruta, token = titular) => {
            const r = await pedir(ruta, { token });
            assert.equal(r.status, 200, ruta);
            return r.json();
        };
        const idTitular = (await leer("/auth/sesion")).idUsuario;
        const idOtroCliente = (await leer("/auth/sesion", otroCliente)).idUsuario;
        const base = { nombrePresupuesto: "Límite compartido", montoPresupuesto: "100.00", fechaInicio: hoy, fechaFin: manana, idCategoria: 4 };
        const alta = datos => cambiar("/presupuestos", "POST", { ...base, ...datos });
        const lote = await Promise.all([1, 2, 3, 4].map(i => alta({ nombrePresupuesto: `Cupo ${i}`, fechaInicio: manana })));
        assert.deepEqual(lote.map(r => r.status).sort(), [201, 201, 201, 403]);
        const vencido = await alta({ fechaInicio: ayer, fechaFin: ayer });
        const inactivo = await alta({ estado: "Cancelado" });
        const finalizado = await alta({ estado: "Finalizado" });
        for (const r of [vencido, inactivo, finalizado]) assert.equal(r.status, 201);
        const { id: idVencido } = await vencido.json();
        const { id: idInactivo } = await inactivo.json();
        assert.equal((await cambiar(`/presupuestos/${idInactivo}`, "PUT", { ...base, estado: "Activo" })).status, 403);
        assert.equal((await cambiar(`/presupuestos/${idVencido}`, "PUT", base)).status, 403);
        assert.equal((await cambiar("/suscripcion", "PUT", { tipoPlan: "Premium" })).status, 200);
        const limite = await alta({});
        const meta = await alta({ idCategoria: 1 });
        assert.equal(limite.status, 201);
        assert.equal(meta.status, 201);
        const { id: idLimite } = await limite.json();
        const { id: idMeta } = await meta.json();
        const cargarEventos = async () => (await conexion.execute(
            `SELECT e.idPresupuesto, e.tipo, e.idNotificacion FROM EventoPresupuesto e
             JOIN Notificacion n ON n.idNotificacion = e.idNotificacion WHERE n.idUsuario = ? ORDER BY e.idNotificacion`,
            [idTitular]
        ))[0];
        const movimiento = (monto, datos = {}) => ({
            monto, fecha: hoy, descripcion: "Regresión alertas", idCategoria: 4, idMetodoPago: 1, ...datos
        });
        const primero = await cambiar("/egresos", "POST", movimiento("79.99"));
        assert.equal(primero.status, 201);
        assert.deepEqual(await cargarEventos(), []);
        const { id: gasto } = await primero.json();
        const pendiente = await cambiar("/egresos", "POST", movimiento("0.01", { estadoTransaccion: "Pendiente" }));
        assert.equal(pendiente.status, 201);
        const { id: centavo } = await pendiente.json();
        const editarCentavo = estadoTransaccion => cambiar(`/egresos/${centavo}`, "PUT", movimiento("0.01", { estadoTransaccion }));
        assert.deepEqual(await cargarEventos(), []);
        assert.deepEqual((await Promise.all([editarCentavo("Confirmada"), editarCentavo("Confirmada")])).map(r => r.status), [200, 200]);
        const [alerta] = await cargarEventos();
        assert.equal(alerta.tipo, "Preventiva");
        assert.equal(alerta.idPresupuesto, idLimite);
        assert.deepEqual(await leer("/notificaciones/pendientes"), { pendientes: 1 });
        assert.equal((await cambiar(`/notificaciones/${alerta.idNotificacion}/vista`, "PUT", undefined, contador)).status, 404);
        assert.equal((await cambiar(`/notificaciones/${alerta.idNotificacion}/archivar`, "PUT", undefined, contador)).status, 404);
        assert.equal((await cambiar(`/notificaciones/${alerta.idNotificacion}/vista`, "PUT")).status, 200);
        assert.deepEqual(await leer("/notificaciones/pendientes"), { pendientes: 0 });
        assert.equal((await cambiar(`/notificaciones/${alerta.idNotificacion}/archivar`, "PUT")).status, 200);
        assert.equal((await cambiar(`/notificaciones/${alerta.idNotificacion}/vista`, "PUT")).status, 404);
        assert.equal((await editarCentavo("Anulada")).status, 200);
        assert.equal((await editarCentavo("Confirmada")).status, 200);
        assert.equal((await cambiar(`/egresos/${centavo}`, "DELETE")).status, 200);
        assert.deepEqual(await cargarEventos(), [alerta]);
        assert.equal((await cambiar(`/egresos/${gasto}`, "PUT", movimiento("100.00"))).status, 200);
        assert.equal((await cambiar(`/egresos/${gasto}`, "PUT", movimiento("100.01"))).status, 200);
        assert.equal((await cambiar("/ingresos", "POST", movimiento("200.00", { idCategoria: 1 }))).status, 201);
        assert.deepEqual((await cargarEventos()).map(e => [e.idPresupuesto, e.tipo]), [
            [idLimite, "Preventiva"], [idLimite, "LimiteAlcanzado"], [idLimite, "Exceso"], [idMeta, "MetaAlcanzada"]
        ]);
        assert.deepEqual(await leer("/notificaciones/pendientes"), { pendientes: 3 });
        const listado = await leer("/presupuestos");
        assert.equal(listado.find(p => p.idPresupuesto === idMeta).excedido, false);
        assert.equal(listado.find(p => p.idPresupuesto === idMeta).metaAlcanzada, true);
        assert.equal((await cambiar(`/presupuestos/${idLimite}`, "PUT", { ...base, montoPresupuesto: "130.00" })).status, 200);
        assert.equal((await cambiar(`/presupuestos/${idLimite}`, "PUT", base)).status, 200);
        assert.equal((await cargarEventos()).length, 4);

        assert.equal((await cambiar("/suscripcion", "PUT", { tipoPlan: "Free" })).status, 200);
        assert.equal((await leer("/presupuestos")).length, listado.length);
        assert.equal((await alta({})).status, 403);
        assert.equal((await cambiar(`/presupuestos/${idInactivo}`, "PUT", { ...base, estado: "Activo" })).status, 403);
        assert.equal((await cambiar(`/presupuestos/${idLimite}`, "PUT", base)).status, 200);
        assert.equal((await cambiar(`/presupuestos/${idMeta}`, "PUT", {
            ...base, idCategoria: 1, montoPresupuesto: "250.00"
        })).status, 200);
        assert.equal((await leer("/presupuestos")).find(p => p.idPresupuesto === idMeta).alertaPreventiva, false);
        const antes = await cargarEventos();
        assert.equal(antes.length, 4);
        const [[historico]] = await conexion.execute("SELECT estado FROM Notificacion WHERE idNotificacion = ?", [alerta.idNotificacion]);
        assert.equal(historico.estado, "Archivada");

        for (const [i, sesion] of [[30, titular], [32, otroCliente]]) {
            const enviar = () => cambiar("/vinculos", "POST", { correoCliente: ficha(i).correo }, contador);
            assert.equal((await enviar()).status, 201);
            assert.equal((await enviar()).status, 409);
            const [vinculo] = await leer("/vinculos", sesion);
            assert.equal((await cambiar(`/vinculos/${vinculo.idVinculo}/responder`, "PUT", { aceptar: false }, sesion)).status, 200);
            assert.equal((await enviar()).status, 201);
            assert.equal((await cambiar(`/vinculos/${vinculo.idVinculo}/responder`, "PUT", { aceptar: true }, sesion)).status, 200);
        }
        const sufijo = `?clienteId=${idTitular}`;
        assert.equal((await leer(`/dashboard${sufijo}`, contador)).egresos, "100.01");
        assert.equal((await leer(`/dashboard?clienteId=${idOtroCliente}`, contador)).egresos, "0.00");
        assert.equal((await leer(`/presupuestos${sufijo}`, contador)).length, listado.length);
        assert.equal((await cambiar(`/presupuestos${sufijo}`, "POST", base, contador)).status, 403);
        assert.equal((await pedir(`/notificaciones${sufijo}`, { token: contador })).status, 403);
        assert.equal((await pedir(`/notificaciones/pendientes${sufijo}`, { token: contador })).status, 403);
        assert.ok((await leer("/notificaciones", contador)).every(n => !n.mensaje.includes("Límite compartido")));
        assert.deepEqual(await cargarEventos(), antes);
        await assert.rejects(
            conexion.execute("UPDATE CategoriaFinanciera SET tipo = 'Ingreso' WHERE idCategoria = 4"),
            { code: "ER_SIGNAL_EXCEPTION" }
        );
    });

    await t.test("facturación persistente, pagos e integración con suscripciones", async () => {
        for (const i of [40, 41]) {
            assert.equal(await pedir("/auth/registro", {
                method: "POST", datos: { ...ficha(i), rol: "Emprendedor" }
            }).then(r => r.status), 201);
        }
        const titular = await login(40);
        const tercero = await login(41);
        const [[{ hoy }]] = await conexion.query("SELECT CAST(CURDATE() AS CHAR) AS hoy");
        const llamar = (ruta, method = "GET", datos, token = titular) => pedir(ruta, { token, method, datos });
        const leer = async (ruta, token = titular) => {
            const r = await llamar(ruta, "GET", undefined, token);
            assert.equal(r.status, 200, ruta);
            return r.json();
        };
        const titularId = (await leer("/auth/sesion")).idUsuario;
        const datos = {
            fecha: hoy, receptorNombre: "Receptor de Prueba", receptorDocumento: "DEMO-881",
            detalle: [
                { concepto: "Servicio", cantidad: "1.005", precioUnitario: "10.00", porcentajeDescuento: "10.00", porcentajeImpuesto: "19.00" },
                { concepto: "Producto", cantidad: "2", precioUnitario: "0.11" }
            ],
            total: "9999.99"
        };
        const alta = async (datosAlta = datos) => {
            const r = await llamar("/facturas", "POST", datosAlta);
            assert.equal(r.status, 201);
            return r.json();
        };
        const facturas = await Promise.all([alta(), alta(), alta({ ...datos, emitir: true })]);
        assert.deepEqual(facturas.map(f => f.consecutivo).sort((a, b) => a - b), [1, 2, 3]);
        assert.deepEqual(facturas.map(f => f.total), ["10.98", "10.98", "10.98"]);
        const [borrador, otroBorrador, emitida] = facturas;
        assert.equal(emitida.estado, "Pendiente");
        assert.equal(emitida.detalle[0].descuento, "1.01");
        assert.equal(emitida.detalle[0].impuesto, "1.72");
        assert.equal((await leer("/dashboard")).ingresos, "0.00");
        for (const consulta of [emitida.numero, datos.receptorDocumento, "Receptor"]) {
            const r = await leer(`/facturas?estado=Pendiente&buscar=${encodeURIComponent(consulta)}&desde=${hoy}&hasta=${hoy}`);
            assert.equal(r.facturas.length, 1);
            assert.equal(r.resumen.pendiente, "10.98");
        }
        assert.equal((await llamar("/facturas?desde=2025-02-29")).status, 400);
        const ruta = id => `/facturas/${id}`;
        const estado = (id, valor, extras = {}, token = titular) => llamar(`${ruta(id)}/estado`, "PUT", { estado: valor, ...extras }, token);
        assert.equal((await leer("/facturas", tercero)).facturas.length, 0);
        assert.equal((await llamar(ruta(emitida.idFactura), "GET", undefined, tercero)).status, 404);
        assert.equal((await llamar(ruta(borrador.idFactura), "PUT", datos, tercero)).status, 404);
        assert.equal((await estado(emitida.idFactura, "Anulada", {}, tercero)).status, 404);
        assert.equal((await llamar(`${ruta(emitida.idFactura)}?clienteId=${titularId}`)).status, 403);
        assert.equal((await llamar(ruta(emitida.idFactura), "DELETE")).status, 404);
        assert.equal((await llamar(ruta(emitida.idFactura), "PUT", datos)).status, 409);
        assert.equal((await estado(borrador.idFactura, "Pagada")).status, 409);
        assert.equal((await estado(otroBorrador.idFactura, "Anulada")).status, 200);
        assert.equal((await estado(otroBorrador.idFactura, "Pendiente")).status, 409);
        const modificado = await llamar(ruta(borrador.idFactura), "PUT", { ...datos, receptorNombre: "Nuevo receptor" });
        assert.equal(modificado.status, 200);
        assert.equal((await modificado.json()).revision, 2);
        const [[{ versiones }]] = await conexion.execute("SELECT COUNT(*) AS versiones FROM FacturaDetalle WHERE idFactura = ?", [borrador.idFactura]);
        assert.equal(versiones, 4);
        assert.equal((await estado(borrador.idFactura, "Pendiente")).status, 200);
        assert.equal((await leer(ruta(borrador.idFactura))).receptorNombre, "Nuevo receptor");
        // Cambio ficticio en el esquema de pruebas para verificar la copia del emisor emitido.
        await conexion.execute("UPDATE Usuario SET nombre = 'Nombre nuevo' WHERE idUsuario = ?", [titularId]);
        const recuperada = await leer(ruta(emitida.idFactura));
        assert.equal(recuperada.emisorNombre, emitida.emisorNombre);
        assert.deepEqual(recuperada.detalle, emitida.detalle);
        for (const cambio of [
            { cantidad: "-1" }, { cantidad: "0" }, { cantidad: "1.0001" }, { precioUnitario: "-1" },
            { precioUnitario: "0.001" }, { porcentajeDescuento: "100.01" }, { porcentajeImpuesto: "1e2" },
            { cantidad: "2", precioUnitario: "9999999999.99" }
        ]) {
            assert.equal((await llamar("/facturas", "POST", { ...datos, detalle: [{ ...datos.detalle[0], ...cambio }] })).status, 400);
        }
        await conexion.query(`CREATE TRIGGER Prueba_FalloDetalle BEFORE INSERT ON FacturaDetalle FOR EACH ROW
            BEGIN IF NEW.concepto = 'Fallo controlado' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fallo de prueba'; END IF; END`);
        assert.equal((await llamar("/facturas", "POST", { ...datos, detalle: [...datos.detalle, { ...datos.detalle[0], concepto: "Fallo controlado" }] })).status, 400);
        assert.equal((await leer("/facturas")).facturas.length, 3);

        const pago = { idCategoria: 1, idMetodoPago: 1 };
        assert.equal((await estado(emitida.idFactura, "Pagada", { ...pago, idCategoria: 4 })).status, 400);
        const pp = await llamar("/presupuestos", "POST", {
            nombrePresupuesto: "Ventas facturadas", montoPresupuesto: "10.98", idCategoria: 1, fechaInicio: hoy, fechaFin: hoy
        });
        assert.equal(pp.status, 201);
        await conexion.query(`CREATE TRIGGER Prueba_FalloPago BEFORE UPDATE ON Factura FOR EACH ROW
            BEGIN IF NEW.receptorNombre = 'Nuevo receptor' AND NEW.estado = 'Pagada' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fallo de prueba'; END IF; END`);
        assert.equal((await estado(borrador.idFactura, "Pagada", pago)).status, 400);
        assert.equal((await leer(ruta(borrador.idFactura))).estado, "Pendiente");
        assert.equal((await leer("/ingresos")).length, 0);
        const pagos = await Promise.all([estado(emitida.idFactura, "Pagada", pago), estado(emitida.idFactura, "Pagada", pago)]);
        assert.deepEqual(pagos.map(r => r.status), [200, 200]);
        const pagadas = await Promise.all(pagos.map(r => r.json()));
        const idIngreso = pagadas[0].idIngreso;
        assert.ok(idIngreso);
        assert.equal(pagadas[1].idIngreso, idIngreso);
        assert.equal((await leer("/ingresos")).length, 1);
        assert.equal((await estado(emitida.idFactura, "Anulada")).status, 409);
        assert.equal((await llamar(`/ingresos/${idIngreso}`, "DELETE")).status, 409);
        assert.equal((await llamar(`/ingresos/${idIngreso}`, "PUT", { ...pago, monto: "2.00", descripcion: "Intento de editar", fecha: hoy })).status, 409);
        assert.equal((await leer("/dashboard")).ingresos, "10.98");
        assert.equal((await leer(`/reportes?desde=${hoy}&hasta=${hoy}`)).totales.ingresos, "10.98");
        assert.equal((await leer("/analisis")).totales.ingresos, "10.98");
        assert.equal((await leer("/presupuestos"))[0].ejecutado, "10.98");
        assert.ok((await leer("/notificaciones")).some(n => n.mensaje.includes("meta de ingresos")));
        assert.deepEqual((await leer("/facturas")).resumen, { facturado: "21.96", pagado: "10.98", pendiente: "10.98", cantidad: 3 });

        const cambiarPlan = tipoPlan => llamar("/suscripcion", "PUT", { tipoPlan });
        const plan = () => leer("/suscripcion");
        assert.equal((await plan()).beneficios.presupuestosActivos, 3);
        assert.equal((await plan()).beneficios.exportarExcel, false);
        assert.equal((await (await cambiarPlan("Premium")).json()).pagoSimulado, true);
        const primero = await plan();
        assert.equal(primero.beneficios.exportarExcel, true);
        assert.equal(primero.beneficios.clientes, null);
        assert.equal((await cambiarPlan("Premium")).status, 200);
        const renovado = await plan();
        assert.equal(renovado.fechaInicio, primero.fechaInicio);
        assert.ok(renovado.fechaFin > primero.fechaFin);
        await conexion.execute(`UPDATE Suscripcion SET fechaInicio = DATE_SUB(CURDATE(), INTERVAL 2 DAY),
            fechaFin = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE idUsuario = ?`, [titularId]);
        assert.equal((await plan()).planEfectivo, "Free");
        const entorno = process.env.NODE_ENV;
        try {
            process.env.NODE_ENV = "production";
            assert.equal((await plan()).pagoSimuladoDisponible, false);
            assert.equal((await cambiarPlan("Premium")).status, 403);
            assert.equal((await cambiarPlan("Free")).status, 200);
        } finally {
            process.env.NODE_ENV = entorno;
        }
        assert.equal((await leer("/facturas")).facturas.length, 3);
    });

    await t.test("conciliación, borradores incompletos y permiso delegado revocable", async () => {
        for (const [i, rol] of [[50, "Emprendedor"], [51, "Contador"], [52, "Emprendedor"]]) {
            assert.equal((await pedir("/auth/registro", { method: "POST", datos: { ...ficha(i), rol } })).status, 201);
        }
        const [titular, contador, tercero] = await Promise.all([login(50), login(51), login(52)]);
        const llamar = (ruta, method = "GET", datos, token = titular) => pedir(ruta, { method, datos, token });
        const id = async token => (await (await llamar("/auth/sesion", "GET", undefined, token)).json()).idUsuario;
        const [idTitular, idContador, idTercero] = await Promise.all([id(titular), id(contador), id(tercero)]);
        const [[fechas]] = await conexion.query(`SELECT CAST(CURDATE() AS CHAR) AS hoy,
            CAST(DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS CHAR) AS ayer,
            CAST(DATE_ADD(CURDATE(), INTERVAL 1 DAY) AS CHAR) AS manana`);
        const datos = { fecha: fechas.hoy, receptorNombre: "Cliente ficticio de conciliación",
            detalle: [{ concepto: "Servicio", cantidad: "1", precioUnitario: "10.99" }] };
        const alto = await llamar("/facturas", "POST", {
            detalle: [{ concepto: "Detalle pendiente", precioUnitario: "0", cantidad: "" }]
        });
        assert.equal(alto.status, 201);
        const incompleta = await alto.json();
        assert.equal(incompleta.fecha, null);
        assert.equal(incompleta.total, "0.00");
        assert.equal(incompleta.borradorDetalle[0].concepto, "Detalle pendiente");
        const factura = idFactura => `/facturas/${idFactura}`;
        const estado = (idFactura, datosEstado, token = titular, sufijo = "") =>
            llamar(`${factura(idFactura)}/estado${sufijo}`, "PUT", datosEstado, token);
        assert.equal((await estado(incompleta.idFactura, { estado: "Pendiente" })).status, 400);
        const cero = { ...datos, detalle: [{ ...datos.detalle[0], porcentajeDescuento: "100" }] };
        assert.equal((await llamar("/facturas", "POST", { ...cero, emitir: true })).status, 400);
        assert.equal((await llamar(factura(incompleta.idFactura), "PUT", cero)).status, 200);
        assert.equal((await estado(incompleta.idFactura, { estado: "Pendiente" })).status, 400);
        assert.equal((await llamar(factura(incompleta.idFactura), "PUT", datos)).status, 200);
        assert.equal((await estado(incompleta.idFactura, { estado: "Pendiente" })).status, 200);
        const segunda = await (await llamar("/facturas", "POST", { ...datos, emitir: true })).json();
        const borrador = await (await llamar("/facturas", "POST", datos)).json();

        const movimiento = async (cambio = {}, token = titular) => {
            const r = await llamar("/ingresos", "POST", {
                descripcion: "Ingreso ficticio", monto: "10.99", fecha: fechas.hoy,
                idCategoria: 2, idMetodoPago: 2, ...cambio
            }, token);
            assert.equal(r.status, 201);
            return (await r.json()).id;
        };
        const correcto = await movimiento();
        const antiguos = await Promise.all([
            movimiento({ monto: "10.98" }), movimiento({ fecha: fechas.ayer }),
            movimiento({ fecha: fechas.manana }), movimiento({ estadoTransaccion: "Pendiente" }), movimiento({}, tercero)
        ]);
        const elegibles = `${factura(incompleta.idFactura)}/ingresos-elegibles`;
        assert.deepEqual((await (await llamar(elegibles)).json()).map(i => i.idIngreso), [correcto]);
        const conciliar = (idFactura, idIngreso = correcto, confirmarConciliacion = true) =>
            estado(idFactura, { estado: "Pagada", idIngreso, confirmarConciliacion });
        assert.equal((await conciliar(incompleta.idFactura, correcto, false)).status, 400);
        for (const ajeno of antiguos) assert.equal((await conciliar(incompleta.idFactura, ajeno)).status, 400);
        const antes = await (await llamar("/dashboard")).json();
        const dos = await Promise.all([conciliar(incompleta.idFactura), conciliar(segunda.idFactura)]);
        assert.deepEqual(dos.map(r => r.status).sort(), [200, 400]);
        const pagada = await dos.find(r => r.status === 200).json();
        assert.equal(pagada.idIngreso, correcto);
        assert.equal(pagada.fechaPago, fechas.hoy);
        assert.deepEqual(await (await llamar("/dashboard")).json(), antes);
        const [m] = (await (await llamar("/ingresos")).json()).filter(i => i.id === correcto);
        assert.deepEqual([m.fecha, m.idCategoria, m.idMetodoPago], [fechas.hoy, 2, 2]);
        assert.equal((await conciliar(pagada.idFactura)).status, 200);
        assert.ok((await (await llamar("/historial")).json()).some(a => a.accion.includes(`conciliación con ingreso #${correcto}`)));

        const [vinculo] = await conexion.execute("INSERT INTO ClienteContador (idContador, idCliente, estado) VALUES (?, ?, 'Aceptado')", [idContador, idTitular]);
        await conexion.execute("INSERT INTO ClienteContador (idContador, idCliente, estado) VALUES (?, ?, 'Aceptado')", [idContador, idTercero]);
        const permiso = (autorizar, token = titular) => llamar(`/vinculos/${vinculo.insertId}/facturas`, "PUT", { autorizar }, token);
        const sufijo = `?clienteId=${idTitular}`;
        const delegado = ruta => llamar(`${ruta}${sufijo}`, "GET", undefined, contador);
        assert.equal((await delegado("/facturas")).status, 403);
        assert.equal((await permiso(true, contador)).status, 403);
        assert.equal((await permiso(true, tercero)).status, 404);
        assert.equal((await permiso(true)).status, 200);
        const lista = await (await delegado("/facturas")).json();
        assert.equal(lista.facturas.length, 2);
        assert.equal(lista.resumen.pagado, "10.99");
        assert.equal((await delegado(factura(pagada.idFactura))).status, 200);
        assert.equal((await delegado(factura(borrador.idFactura))).status, 404);
        assert.equal((await delegado(elegibles)).status, 403);
        assert.equal((await llamar(`/facturas${sufijo}`, "POST", datos, contador)).status, 403);
        assert.equal((await llamar(`${factura(pagada.idFactura)}${sufijo}`, "PUT", datos, contador)).status, 403);
        assert.equal((await estado(pagada.idFactura, { estado: "Anulada" }, contador, sufijo)).status, 403);
        assert.equal((await llamar(`${factura(pagada.idFactura)}${sufijo}`, "DELETE", undefined, contador)).status, 403);
        assert.equal((await llamar(`/facturas?clienteId=${idTercero}`, "GET", undefined, contador)).status, 403);
        assert.equal((await permiso(false)).status, 200);
        assert.equal((await delegado(factura(pagada.idFactura))).status, 403);
        assert.equal((await permiso(true)).status, 200);
        await conexion.execute("UPDATE ClienteContador SET estado = 'Suspendido' WHERE idVinculo = ?", [vinculo.insertId]);
        await conexion.execute("UPDATE ClienteContador SET estado = 'Aceptado' WHERE idVinculo = ?", [vinculo.insertId]);
        assert.equal((await delegado("/facturas")).status, 403);
    });

    await t.test("corrección de pagos, historial por operación y rollback", async () => {
        for (const [i, rol] of [[60, "Emprendedor"], [61, "Contador"], [62, "Emprendedor"]]) {
            assert.equal((await pedir("/auth/registro", { method: "POST", datos: { ...ficha(i), rol } })).status, 201);
        }
        const [titular, contador, tercero] = await Promise.all([login(60), login(61), login(62)]);
        const llamar = (ruta, method = "GET", datos, token = titular) => pedir(ruta, { method, datos, token });
        const leer = async (ruta, token = titular) => {
            const respuesta = await llamar(ruta, "GET", undefined, token);
            assert.equal(respuesta.status, 200, ruta);
            return respuesta.json();
        };
        const idTitular = (await leer("/auth/sesion")).idUsuario;
        const idContador = (await leer("/auth/sesion", contador)).idUsuario;
        const [[{ hoy }]] = await conexion.query("SELECT CAST(CURDATE() AS CHAR) AS hoy");
        const alta = async () => {
            const r = await llamar("/facturas", "POST", {
                emitir: true, fecha: hoy, receptorNombre: "Receptor de corrección",
                detalle: [{ concepto: "Servicio de prueba", cantidad: "1", precioUnitario: "20.55" }]
            });
            assert.equal(r.status, 201);
            return r.json();
        };
        const factura = await alta();
        const rutaFactura = id => `/facturas/${id}`;
        const pagar = async (id, extras = { idCategoria: 1, idMetodoPago: 1 }) => {
            const r = await llamar(`${rutaFactura(id)}/estado`, "PUT", { estado: "Pagada", ...extras });
            assert.equal(r.status, 200);
            return r.json();
        };
        const corregir = (id, idPago, extras = {}, token = titular, sufijo = "") => llamar(
            `${rutaFactura(id)}/correcciones-pago${sufijo}`, "POST",
            { idPago, confirmar: true, motivo: "Pago de prueba registrado por error", ...extras }, token
        );
        const [vinculo] = await conexion.execute(
            "INSERT INTO ClienteContador (idContador, idCliente, estado) VALUES (?, ?, 'Aceptado')", [idContador, idTitular]
        );
        assert.equal((await llamar(`/vinculos/${vinculo.insertId}/facturas`, "PUT", { autorizar: true })).status, 200);
        assert.equal((await llamar("/presupuestos", "POST", {
            nombrePresupuesto: "Meta para corrección", montoPresupuesto: "20.55", idCategoria: 1, fechaInicio: hoy, fechaFin: hoy
        })).status, 201);
        const pagada = await pagar(factura.idFactura);
        const [original] = pagada.historialPagos;
        assert.equal(original.origen, "Facturacion");
        assert.equal((await leer("/dashboard")).balance, "20.55");
        assert.equal((await corregir(factura.idFactura, original.idPago, { motivo: " " })).status, 400);
        assert.equal((await corregir(factura.idFactura, original.idPago, { confirmar: false })).status, 400);
        assert.equal((await corregir(factura.idFactura, original.idPago, {}, tercero)).status, 404);
        assert.equal((await corregir(factura.idFactura, original.idPago, {}, contador, `?clienteId=${idTitular}`)).status, 403);
        assert.equal((await leer(`${rutaFactura(factura.idFactura)}?clienteId=${idTitular}`, contador)).historialPagos, undefined);
        await conexion.query(`CREATE TRIGGER Prueba_FalloCorreccion BEFORE INSERT ON HistorialActividad FOR EACH ROW
            BEGIN IF NEW.modulo = 'Facturación' AND NEW.accion LIKE '%corrección del pago%' AND NEW.ipUsuario = '127.0.0.1'
                AND EXISTS (SELECT 1 FROM PagoFactura WHERE motivoCorreccion = 'Fallo controlado de corrección')
                THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fallo de prueba'; END IF; END`);
        assert.equal((await corregir(factura.idFactura, original.idPago, { motivo: "Fallo controlado de corrección" })).status, 400);
        const sinCambios = await leer(rutaFactura(factura.idFactura));
        assert.equal(sinCambios.estado, "Pagada");
        assert.deepEqual(sinCambios.historialPagos, pagada.historialPagos);
        assert.equal((await leer("/dashboard")).balance, "20.55");

        const simultaneas = await Promise.all([corregir(factura.idFactura, original.idPago), corregir(factura.idFactura, original.idPago)]);
        assert.deepEqual(simultaneas.map(r => r.status).sort(), [200, 409]);
        const corregida = await simultaneas.find(r => r.status === 200).json();
        assert.equal(corregida.estado, "Pendiente");
        assert.equal(corregida.idIngreso, null);
        assert.equal(corregida.fechaPago, null);
        assert.equal(corregida.historialPagos[0].idIngreso, original.idIngreso);
        assert.equal(corregida.historialPagos[0].idActorCorreccion, idTitular);
        assert.equal(corregida.historialPagos[0].motivoCorreccion, "Pago de prueba registrado por error");
        assert.ok(corregida.historialPagos[0].corregidoEn);
        assert.equal((await leer("/ingresos")).find(i => i.id === original.idIngreso).estadoTransaccion, "Anulada");
        assert.equal((await leer("/dashboard")).balance, "0.00");
        assert.equal((await leer(`/reportes?desde=${hoy}&hasta=${hoy}`)).totales.ingresos, "0.00");
        assert.equal((await leer("/analisis")).totales.ingresos, "0.00");
        assert.equal((await leer("/presupuestos"))[0].ejecutado, "0.00");
        assert.equal((await llamar(`/ingresos/${original.idIngreso}`, "DELETE")).status, 409);
        if (process.env.CONTASYS_FACTURA_CORREGIDA) {
            writeFileSync(process.env.CONTASYS_FACTURA_CORREGIDA, JSON.stringify(await leer(rutaFactura(factura.idFactura))), "utf8");
        }
        const repagada = await pagar(factura.idFactura);
        const nuevo = repagada.historialPagos[0];
        assert.notEqual(nuevo.idPago, original.idPago);
        assert.notEqual(nuevo.idIngreso, original.idIngreso);
        assert.equal(repagada.historialPagos.length, 2);
        assert.equal((await corregir(factura.idFactura, original.idPago)).status, 409);
        assert.equal((await leer("/dashboard")).balance, "20.55");
        assert.equal((await leer("/notificaciones")).filter(n => n.mensaje.includes("Meta para corrección")).length, 1);
        assert.equal((await corregir(factura.idFactura, nuevo.idPago)).status, 200);

        const movimiento = await llamar("/ingresos", "POST", {
            monto: "20.55", fecha: hoy, descripcion: "Ingreso legítimo", idCategoria: 2, idMetodoPago: 2
        });
        assert.equal(movimiento.status, 201);
        const { id: legitimo } = await movimiento.json();
        const extras = { idIngreso: legitimo, confirmarConciliacion: true };
        const conciliada = await pagar(factura.idFactura, extras);
        const conciliacion = conciliada.historialPagos[0];
        assert.equal(conciliacion.origen, "Conciliacion");
        const balanceAnterior = (await leer("/dashboard")).balance;
        const ingresoAnterior = (await leer("/ingresos")).find(i => i.id === legitimo);
        assert.equal((await corregir(factura.idFactura, conciliacion.idPago)).status, 200);
        assert.equal((await leer("/dashboard")).balance, balanceAnterior);
        assert.deepEqual((await leer("/ingresos")).find(i => i.id === legitimo), ingresoAnterior);
        assert.equal((await llamar(`/ingresos/${legitimo}`, "DELETE")).status, 409);
        const facturaCorrecta = await alta();
        assert.equal((await pagar(facturaCorrecta.idFactura, extras)).idIngreso, legitimo);
        const historial = (await leer("/historial")).filter(a => a.accion.includes("corrección del pago"));
        assert.equal(historial.length, 3);

        // Pago previo al registro del origen, simulado en un esquema aislado.
        const legado = await alta();
        const legacy = await llamar("/ingresos", "POST", {
            monto: "20.55", fecha: hoy, descripcion: "Pago previo", idCategoria: 1, idMetodoPago: 1
        });
        assert.equal(legacy.status, 201);
        await conexion.execute("UPDATE Factura SET estado = 'Pagada', fechaPago = ?, idIngreso = ? WHERE idFactura = ?",
            [hoy, (await legacy.json()).id, legado.idFactura]);
        assert.deepEqual((await leer(rutaFactura(legado.idFactura))).historialPagos, []);
        assert.equal((await corregir(legado.idFactura, original.idPago)).status, 409);
        assert.equal((await leer(rutaFactura(legado.idFactura))).estado, "Pagada");
    });

    await t.test("paginación estable, chat incremental y mantenimiento idempotente", async () => {
        for (const i of [70, 71]) {
            assert.equal((await pedir("/auth/registro", { method: "POST", datos: { ...ficha(i), rol: "Emprendedor" } })).status, 201);
        }
        const [titular, contacto] = await Promise.all([login(70), login(71)]);
        const leer = async (ruta, token = titular) => {
            const r = await pedir(ruta, { token });
            assert.equal(r.status, 200, ruta);
            return r.json();
        };
        const [a, b] = await Promise.all([leer("/auth/sesion"), leer("/auth/sesion", contacto)]);
        const [[{ hoy, ayer, manana }]] = await conexion.query(`SELECT CAST(CURDATE() AS CHAR) hoy,
            CAST(DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS CHAR) ayer,
            CAST(DATE_ADD(CURDATE(), INTERVAL 1 DAY) AS CHAR) manana`);
        await conexion.query("INSERT INTO Notificacion (mensaje,idUsuario) VALUES ?", [[1, 2, 3].map(i => [`Notificación ${i}`, a.idUsuario])]);
        await conexion.execute("INSERT INTO HistorialActividad (accion,modulo,idUsuario) VALUES ('Prueba de página','Pruebas',?)", [a.idUsuario]);
        await conexion.query(`INSERT INTO Ingreso (monto,fecha,idUsuario,idCategoria,idMetodoPago,estadoTransaccion) VALUES ?`,
            [[["0.20", "Confirmada"], ["0.10", "Confirmada"], ["4.00", "Pendiente"]]
                .map(([monto, estado]) => [monto, hoy, a.idUsuario, 1, 1, estado])]);
        for (const ruta of ["/ingresos", "/notificaciones", "/historial", "/facturas"]) {
            if (ruta === "/facturas") {
                for (const datos of [{}, {}, { emitir: true, fecha: hoy, receptorNombre: "Prueba", detalle: [
                    { concepto: "Prueba", cantidad: "1", precioUnitario: "0.30" }
                ] }]) assert.equal((await pedir(ruta, { token: titular, method: "POST", datos })).status, 201);
            }
            const primero = await leer(ruta + "?limite=1");
            assert.ok(primero.siguiente, ruta);
            const segundo = await leer(ruta + "?limite=1&cursor=" + primero.siguiente);
            assert.notDeepEqual(primero.registros || primero.facturas, segundo.registros || segundo.facturas);
            if (ruta === "/facturas") {
                const tercero = await leer(ruta + "?limite=1&cursor=" + segundo.siguiente);
                assert.equal(tercero.siguiente, null);
                assert.equal(tercero.facturas[0].fecha, null);
                assert.deepEqual(primero.resumen, tercero.resumen);
                assert.equal(primero.resumen.facturado, "0.30");
            }
            if (ruta === "/ingresos") {
                assert.deepEqual(primero.totales, { confirmado: "0.30", pendiente: "4.00" });
                assert.deepEqual(primero.totales, segundo.totales);
                assert.equal((await leer(ruta + "?limite=1", contacto)).registros.length, 0);
            }
            assert.equal((await pedir(ruta + "?limite=101", { token: titular })).status, 400);
        }
        const enviar = (contenido, token, idReceptor) => pedir("/mensajes", { token, method: "POST", datos: { idReceptor, contenido } });
        for (const texto of ["Uno", "Dos", "Tres"]) assert.equal((await enviar(texto, contacto, a.idUsuario)).status, 201);
        const chat = `/mensajes/${b.idUsuario}?limite=2`;
        const reciente = await leer(chat);
        assert.deepEqual(reciente.registros.map(m => m.contenido), ["Dos", "Tres"]);
        assert.ok(reciente.registros.every(m => m.leido));
        assert.equal(reciente.hayMas, true);
        assert.deepEqual((await leer(`${chat}&antes=${reciente.registros[0].idMensaje}`)).registros.map(m => m.contenido), ["Uno"]);
        const ultimo = reciente.registros[1].idMensaje;
        assert.deepEqual(await leer(`${chat}&despues=${ultimo}`), { registros: [], hayMas: false });
        assert.equal((await enviar("Cuatro", titular, b.idUsuario)).status, 201);
        assert.deepEqual((await leer(`${chat}&despues=${ultimo}`)).registros.map(m => m.contenido), ["Cuatro"]);
        await conexion.execute("UPDATE Usuario SET estado = 'Inactivo' WHERE idUsuario = ?", [b.idUsuario]);
        assert.equal((await enviar("No enviar", titular, b.idUsuario)).status, 409);

        const [presupuesto] = await conexion.execute(`INSERT INTO Presupuesto
            (nombrePresupuesto,montoPresupuesto,fechaInicio,fechaFin,idUsuario,idCategoria)
            VALUES ('Meta por inicio de periodo',0.30,?,?,?,1)`, [manana, manana, a.idUsuario]);
        await conexion.execute("UPDATE Presupuesto SET fechaInicio = ? WHERE idPresupuesto = ?", [ayer, presupuesto.insertId]);
        await leer("/presupuestos");
        assert.equal((await leer("/notificaciones")).some(n => n.mensaje.includes("Meta por inicio")), false);
        const { crearEvaluador } = require("../src/utils/mantenimientoAlertas");
        const uno = crearEvaluador({ lote: 100 });
        const dos = crearEvaluador({ lote: 100 });
        await Promise.all([uno(), dos()]);
        await uno();
        assert.equal((await leer("/notificaciones")).filter(n => n.mensaje.includes("Meta por inicio")).length, 1);
    });

    await t.test("pool saturado y conexión perdida se recuperan en el esquema aislado", async () => {
        const arrendadas = await Promise.all(Array.from({ length: 10 }, () => pool.getConnection()));
        try {
            const { enTransaccion } = require("../src/utils/transaccion");
            await assert.rejects(enTransaccion(() => assert.fail("La tarea no debe iniciar sin conexión")),
                { code: "CONTASYS_POOL_TIMEOUT" });
        } finally {
            for (const c of arrendadas) c.release();
        }
        const interrumpida = await pool.getConnection();
        try {
            const [[info]] = await interrumpida.query("SELECT CONNECTION_ID() AS id, DATABASE() AS esquema");
            assert.equal(info.esquema, nombreDb);
            assert.ok(Number.isSafeInteger(info.id));
            // Se interrumpe solo la conexión arrendada del esquema de pruebas, sin transacción abierta.
            await conexion.query(`KILL CONNECTION ${info.id}`);
            await assert.rejects(interrumpida.query("SELECT 1"));
        } finally {
            interrumpida.release();
        }
        assert.equal((await pedir("/salud")).status, 200);
    });

    await pool.end();
    poolCerrado = true;
    assert.equal(await pedir("/salud").then(r => r.status), 503);
});

test("actualización de un esquema demo y suspensión de vínculos heredados", {
    skip: process.env.CONTASYS_PRUEBA_MYSQL !== "1",
    timeout: 30000
}, async t => {
    const { conexion } = await abrirBaseAislada(t, "demo");
    for (const archivo of [
        "CONTASYS_PRODUCCION.sql", "MIGRACION_ROLES_PREMIUM.sql", "MIGRACION_SESIONES.sql", "pruebas/DATOS_DEMO.sql"
    ]) await ejecutarSql(conexion, archivo);
    await conexion.execute("INSERT INTO ClienteContador (idContador, idCliente, estado) VALUES (1, 3, 'Aceptado')");
    for (const archivo of migracionesProteccion) await ejecutarSql(conexion, archivo);
    for (const archivo of migracionesFase4) await ejecutarSql(conexion, archivo);
    await ejecutarSql(conexion, migracionFacturas);
    await ejecutarSql(conexion, migracionConciliacion);
    await ejecutarSql(conexion, migracionCorrecciones);
    await ejecutarSql(conexion, "MIGRACION_RENDIMIENTO.sql");
    const [[legado]] = await conexion.query("SELECT estado FROM ClienteContador WHERE idContador = 1 AND idCliente = 3");
    assert.equal(legado.estado, "Suspendido");
    const [[objetos]] = await conexion.query(
        `SELECT SUM(TABLE_TYPE = 'BASE TABLE') AS tablas, SUM(TABLE_TYPE = 'VIEW') AS vistas
         FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
    );
    assert.equal(Number(objetos.tablas), 18);
    assert.equal(Number(objetos.vistas), 8);
    const [[datos]] = await conexion.query(
        "SELECT (SELECT COUNT(*) FROM Usuario) AS usuarios, (SELECT COUNT(*) FROM Suscripcion) AS planes"
    );
    assert.deepEqual(datos, { usuarios: 4, planes: 4 });
});
