function crearCierre(servidor, { detenerMantenimiento, cerrarPool, salir = codigo => process.exit(codigo) }) {
    let cierre;
    return function cerrar() {
        if (cierre) return cierre;
        const drenado = new Promise(resolve => servidor.close(resolve));
        const limite = setTimeout(() => {
            servidor.closeAllConnections?.();
            salir(1);
        }, 15000);
        limite.unref();
        servidor.closeIdleConnections?.();
        cierre = Promise.all([drenado, detenerMantenimiento()])
            .then(cerrarPool)
            .catch(error => {
                process.exitCode = 1;
                console.error("Error al cerrar CONTASYS:", error.code || error.name);
            }).finally(() => clearTimeout(limite));
        return cierre;
    };
}

module.exports = { crearCierre };
