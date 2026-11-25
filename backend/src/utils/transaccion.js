const pool = require("../config/db");

function adquirirConexion() {
    return new Promise((resolve, reject) => {
        let vencida = false;
        const plazo = setTimeout(() => {
            vencida = true;
            reject(Object.assign(new Error("Espera por conexión agotada"), { code: "CONTASYS_POOL_TIMEOUT" }));
        }, 5000);
        pool.getConnection().then(conexion => {
            clearTimeout(plazo);
            if (vencida) conexion.release();
            else resolve(conexion);
        }, error => {
            clearTimeout(plazo);
            reject(error);
        });
    });
}

async function enTransaccion(operacion) {
    const conexion = await adquirirConexion();
    try {
        await conexion.beginTransaction();
        const resultado = await operacion(conexion);
        await conexion.commit();
        return resultado;
    } catch (error) {
        try { await conexion.rollback(); } catch { conexion.destroy(); }
        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = { enTransaccion };
