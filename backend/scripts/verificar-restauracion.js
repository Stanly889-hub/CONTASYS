const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { randomBytes, createHash } = require("node:crypto");
const { mkdtempSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const mysql = require("mysql2/promise");
const { ejecutarSql } = require("./medir-rendimiento");

async function ejecutar() {
    const origen = process.argv[2] || "";
    if (!/^contasys_prueba_(?:auth|e2e|demo)_[a-f0-9]{8,16}$/.test(origen)) {
        throw new Error("Selecciona un esquema ficticio generado por la suite");
    }
    require("dotenv").config({ quiet: true, path: resolve(__dirname, "../.env") });
    const dest = "contasys_prueba_restaurada_" + randomBytes(5).toString("hex");
    const carpeta = mkdtempSync(join(tmpdir(), "contasys-respaldo-"));
    const archivo = join(carpeta, "datos.sql");
    const host = process.env.DB_HOST || "localhost";
    const port = Number(process.env.DB_PORT || 3306);
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const conexion = await mysql.createConnection({ host, port, user, password, dateStrings: true });
    try {
        const cliente = process.env.CONTASYS_MYSQL_BIN || "";
        const herramienta = nombre => cliente ? join(cliente, nombre + ".exe") : nombre;
        const parametros = ["--protocol=TCP", "--host=" + host, "--port=" + port, "--user=" + user];
        const env = { ...process.env, MYSQL_PWD: password };
        const dump = spawnSync(herramienta("mysqldump"), [...parametros, "--single-transaction", "--no-create-info",
            "--skip-triggers", "--skip-add-locks", "--skip-lock-tables", "--skip-disable-keys", "--no-tablespaces",
            "--set-gtid-purged=OFF", "--result-file=" + archivo, origen], { windowsHide: true, env });
        assert.equal(dump.status, 0, "No se pudo crear el respaldo de datos");
        const sql = readFileSync(archivo);
        assert.doesNotMatch(sql.toString("utf8"), /^\s*(?:DROP|TRUNCATE|DELETE|USE)\b/im);
        await conexion.query(`CREATE DATABASE \`${dest}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await conexion.query(`USE \`${dest}\``);
        const base = ["CONTASYS_PRODUCCION", "MIGRACION_ROLES_PREMIUM", "MIGRACION_SESIONES", "MIGRACION_PROTEGER_USUARIOS",
            "MIGRACION_PROTEGER_VINCULOS", "MIGRACION_ALERTAS_PRESUPUESTO", "MIGRACION_TIPO_CATEGORIA", "MIGRACION_FACTURACION",
            "MIGRACION_FACTURAS_CONCILIACION", "MIGRACION_CORRECCION_PAGOS", "MIGRACION_RENDIMIENTO"];
        // Los catálogos se recuperan del respaldo y conservan sus identificadores.
        for (const f of base) {
            await ejecutarSql(conexion, f + ".sql", { omitirCatalogos: f === "CONTASYS_PRODUCCION" });
        }
        const restaurar = spawnSync(herramienta("mysql"), [...parametros, "--database=" + dest],
            { windowsHide: true, env, input: sql });
        assert.equal(restaurar.status, 0, "MySQL rechazó la restauración de datos");
        const [tablas] = await conexion.execute(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`, [origen]
        );
        const conteos = {};
        for (const { TABLE_NAME: tabla } of tablas) {
            assert.match(tabla, /^\w+$/);
            const [claves] = await conexion.execute(`SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION`, [origen, tabla]);
            assert.ok(claves.length);
            const orden = claves.map(({ COLUMN_NAME: c }) => {
                assert.match(c, /^\w+$/);
                return `\`${c}\``;
            }).join(", ");
            const [a] = await conexion.query(`SELECT * FROM \`${origen}\`.\`${tabla}\` ORDER BY ${orden}`);
            const [b] = await conexion.query(`SELECT * FROM \`${dest}\`.\`${tabla}\` ORDER BY ${orden}`);
            const hash = datos => createHash("sha256").update(JSON.stringify(datos)).digest("hex");
            assert.equal(hash(a), hash(b), `Contenido distinto en ${tabla}`);
            conteos[tabla] = a.length;
        }
        const [controles] = await conexion.query(readFileSync(resolve(__dirname, "../../database/DIAGNOSTICO_MIGRACIONES.sql"), "utf8"));
        assert.ok(controles.every(c => c.resultado === "Compatible"));
        console.log(JSON.stringify({ origen, restaurado: dest, tablasVerificadas: tablas.length, conteos }));
    } finally {
        await conexion.end();
    }
}

ejecutar().catch(error => { console.error("Restauración de prueba:", error.code || error.message); process.exitCode = 1; });
