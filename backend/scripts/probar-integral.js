const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { readFileSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { tmpdir } = require("node:os");
const bcrypt = require("bcryptjs");
const express = require("express");
const mysql = require("mysql2/promise");
const { ejecutarSql } = require("./medir-rendimiento");

const raiz = resolve(__dirname, "../..");
const migraciones = ["CONTASYS_PRODUCCION", "MIGRACION_ROLES_PREMIUM", "MIGRACION_SESIONES",
    "MIGRACION_PROTEGER_USUARIOS", "MIGRACION_PROTEGER_VINCULOS", "MIGRACION_ALERTAS_PRESUPUESTO",
    "MIGRACION_TIPO_CATEGORIA", "MIGRACION_FACTURACION", "MIGRACION_FACTURAS_CONCILIACION",
    "MIGRACION_CORRECCION_PAGOS", "MIGRACION_RENDIMIENTO"];
const claveFicticia = "ContasysPrueba2026!";

async function ejecutar() {
    require("dotenv").config({ quiet: true, path: resolve(raiz, "backend/.env") });
    const opciones = { host: process.env.DB_HOST, port: process.env.DB_PORT,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD };
    const operador = await mysql.createConnection(opciones);
    const sufijo = randomBytes(5).toString("hex");
    const esquema = "contasys_prueba_e2e_" + sufijo;
    const usuario = "contasys_e2e_" + sufijo;
    const clave = randomBytes(24).toString("hex");
    let limitado, servidor, pool, creado;
    try {
        await operador.query(`CREATE DATABASE \`${esquema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await operador.changeUser({ database: esquema });
        for (const migracion of migraciones) await ejecutarSql(operador, migracion + ".sql");
        await operador.query("CREATE USER ?@'localhost' IDENTIFIED BY ?", [usuario, clave]);
        creado = true;
        const grants = readFileSync(resolve(raiz, "database/PERMISOS_CONTASYS_APP.sql"), "utf8")
            .split(/\r?\n/).filter(l => l.startsWith("GRANT "));
        for (const sql of grants) {
            await operador.query(sql.replaceAll("ESQUEMA_CONTASYS", esquema)
                .replaceAll("CUENTA_CONTASYS", usuario).replaceAll("HOST_CONTASYS", "localhost"));
        }
        limitado = await mysql.createConnection({ ...opciones, user: usuario, password: clave, database: esquema });
        const [efectivos] = await limitado.query("SHOW GRANTS");
        const lista = efectivos.flatMap(fila => Object.values(fila));
        assert.ok(lista.some(l => /^GRANT USAGE ON \*\.\*/.test(l)));
        const recursos = lista.filter(l => !/^GRANT USAGE ON \*\.\*/.test(l));
        assert.equal(recursos.length, grants.length);
        assert.ok(recursos.every(l => l.includes(`ON \`${esquema}\`.\``) && !/GRANT OPTION|ALTER|DROP|CREATE/.test(l)));
        await assert.rejects(limitado.query("DELETE FROM Usuario WHERE 1 = 0"), { code: "ER_TABLEACCESS_DENIED_ERROR" });
        await assert.rejects(limitado.query("ALTER TABLE Usuario COMMENT = 'Verificación aislada'"), { code: "ER_TABLEACCESS_DENIED_ERROR" });
        console.log("Permisos verificados. DELETE de Usuario y ALTER rechazados. Grants restringidos al esquema.");
        const hash = await bcrypt.hash(claveFicticia, 10);
        await operador.query(
            "INSERT INTO Usuario (documento,nombre,apellido,correo,password_hash,fechaRegistro,idRol) VALUES ?",
            [[[1, "Admin"], [2, "Contador"], [3, "Emprendedora"]].map(([id, nombre]) =>
                [`E2E-${id}`, nombre, "Prueba", `${nombre.toLowerCase()}@example.invalid`, hash, "2026-01-01", id])]
        );
        await operador.query(`INSERT INTO Suscripcion (tipoPlan,fechaInicio,fechaFin,idUsuario)
            VALUES ('Free',CURDATE(),DATE_ADD(CURDATE(),INTERVAL 1 YEAR),1),
                   ('Free',CURDATE(),DATE_ADD(CURDATE(),INTERVAL 1 YEAR),2),
                   ('Premium',CURDATE(),DATE_ADD(CURDATE(),INTERVAL 1 MONTH),3)`);
        await operador.query(`INSERT INTO Ingreso (monto,descripcion,fecha,idUsuario,idCategoria,idMetodoPago) VALUES ?`,
            [Array.from({ length: 124 }, (_, i) => ["0.10", `Ítem ${String(i + 1).padStart(3, "0")} · Revisión de facturación café`,
                "2026-01-15", 3, 1, 1])]);

        Object.assign(process.env, { DB_NAME: esquema, DB_USER: usuario, DB_PASSWORD: clave,
            JWT_SECRET: randomBytes(32).toString("hex"), NODE_ENV: "development", CORS_ORIGIN: "", CONTASYS_SIMULAR_PAGOS: "true" });
        pool = require("../src/config/db");
        const app = express();
        app.get("/", (_req, res) => res.redirect("/index.html"));
        for (const directorio of ["css", "js", "vendor"]) {
            app.use("/" + directorio, express.static(resolve(raiz, directorio)));
        }
        const paginas = readdirSync(raiz).filter(f => /^[a-z]+\.html$/.test(f));
        for (const pagina of paginas) {
            app.get("/" + pagina, (_req, res) => res.type("html").send(
                readFileSync(resolve(raiz, pagina), "utf8").replace("</head>", '<script>window.CONTASYS_API_URL="/api";</script></head>')
            ));
        }
        app.use(require("../src/app"));
        servidor = app.listen(0, "127.0.0.1");
        await new Promise((aceptar, rechazar) => { servidor.once("listening", aceptar); servidor.once("error", rechazar); });
        const base = `http://127.0.0.1:${servidor.address().port}`;
        assert.equal((await fetch(base + "/api/salud")).status, 200);
        console.log(`Esquema aislado: ${esquema}`);
        const artefactos = resolve(tmpdir(), "contasys-e2e-" + sufijo);
        console.log(`Artefactos ficticios: ${artefactos}`);
        const { DB_PASSWORD, DB_USER, JWT_SECRET, ...entorno } = process.env;
        // Algunos editores ejecutan sus terminales con esta variable. Cypress necesita Electron en modo navegador.
        delete entorno.ELECTRON_RUN_AS_NODE;
        const cli = resolve(raiz, "node_modules/cypress/bin/cypress");
        const abrir = process.argv.includes("--open");
        const args = [cli, abrir ? "open" : "run", "--e2e", "--browser", "chrome"];
        const resultado = await new Promise((aceptar, rechazar) => {
            const hijo = spawn(process.execPath, args, { cwd: raiz, stdio: "inherit",
                env: { ...entorno, CYPRESS_BASE_URL: base, CONTASYS_E2E_ARTEFACTOS: artefactos }, windowsHide: !abrir });
            hijo.once("error", rechazar);
            hijo.once("exit", codigo => aceptar(codigo ?? 1));
        });
        process.exitCode = resultado;
    } finally {
        if (servidor) await new Promise(r => servidor.close(r));
        await pool?.end();
        await limitado?.end();
        if (creado) await operador.query("ALTER USER ?@'localhost' ACCOUNT LOCK", [usuario]);
        await operador.end();
    }
}

ejecutar().catch(error => { console.error("Prueba integral:", error.code || error.message); process.exitCode = 1; });
