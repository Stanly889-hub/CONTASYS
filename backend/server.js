const app = require("./src/app");
const pool = require("./src/config/db");
const { iniciarMantenimientoAlertas } = require("./src/utils/mantenimientoAlertas");
const { crearCierre } = require("./src/utils/cierreServidor");
require("dotenv").config();

const PORT = process.env.PORT || 3000;

const detenerMantenimiento = iniciarMantenimientoAlertas();
const servidor = app.listen(PORT, () => {
    console.log(`CONTASYS API escuchando en http://localhost:${PORT}`);
});
servidor.headersTimeout = 15000;
servidor.requestTimeout = 30000;
servidor.keepAliveTimeout = 5000;
const cerrar = crearCierre(servidor, { detenerMantenimiento, cerrarPool: () => pool.end() });
process.once("SIGINT", cerrar);
process.once("SIGTERM", cerrar);
