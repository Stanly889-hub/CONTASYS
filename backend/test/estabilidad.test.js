const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { test } = require("node:test");
const { crearCierre } = require("../src/utils/cierreServidor");

test("el cierre drena una solicitud HTTP real antes de cerrar el pool", async () => {
    let atender;
    let solicitud;
    const recibida = new Promise(resolve => { solicitud = resolve; });
    const servidor = createServer((_req, res) => {
        atender = () => res.end("atendida");
        solicitud();
    });
    servidor.listen(0, "127.0.0.1");
    await once(servidor, "listening");
    const ruta = `http://127.0.0.1:${servidor.address().port}`;
    let poolCerrado = false;
    const cerrar = crearCierre(servidor, {
        detenerMantenimiento: async () => {},
        cerrarPool: async () => { poolCerrado = true; },
        salir: () => assert.fail("El cierre no debe agotar el plazo")
    });
    const respuesta = fetch(ruta);
    await recibida;
    const cierre = cerrar();
    assert.equal(cerrar(), cierre);
    assert.equal(poolCerrado, false);
    atender();
    assert.equal(await (await respuesta).text(), "atendida");
    await cierre;
    assert.equal(poolCerrado, true);
});
