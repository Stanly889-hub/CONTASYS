const pool = require("../src/config/db");

const DIAS_RETENCION = 30;
const TAMANO_LOTE = 200;

async function retenerSesiones(conexion, aplicar) {
    const corte = Math.floor(Date.now() / 1000) - DIAS_RETENCION * 86400;
    if (!aplicar) {
        const [[fila]] = await conexion.execute(
            "SELECT COUNT(*) AS elegibles FROM Sesion WHERE expiraUnix < ?", [corte]
        );
        return { elegibles: Number(fila.elegibles), maximoPorLote: TAMANO_LOTE };
    }

    const [resultado] = await conexion.execute(
        "DELETE FROM Sesion WHERE expiraUnix < ? ORDER BY expiraUnix, idSesion LIMIT ?",
        [corte, TAMANO_LOTE]
    );
    return { sesionesDepuradas: resultado.affectedRows };
}

async function ejecutar() {
    const argumentos = process.argv.slice(2);
    const aplicar = argumentos.length === 2 && argumentos[0] === "--aplicar" && argumentos[1] === process.env.DB_NAME;
    if (!process.env.DB_NAME || (argumentos.length > 0 && !aplicar)) {
        throw new Error("Configura DB_NAME y usa --aplicar NOMBRE_ESQUEMA para ejecutar un lote");
    }
    console.log({ esquema: process.env.DB_NAME, ...await retenerSesiones(pool, aplicar) });
}

if (require.main === module) {
    ejecutar().catch(error => {
        console.error(error.code || error.message);
        process.exitCode = 1;
    }).finally(() => pool.end());
}

module.exports = { retenerSesiones };
