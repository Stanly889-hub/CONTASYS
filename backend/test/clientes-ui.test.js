const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

test("cambiar de cliente oculta la vista anterior y descarta una respuesta pendiente", async () => {
    const seleccion = idUsuario => JSON.stringify({ idUsuario, nombre: `Cliente ${idUsuario}` });
    const datos = new Map([
        ["sesion", JSON.stringify({ token: "simulado", usuario: { rol: "Contador" } })],
        ["clienteActivo", seleccion(21)]
    ]);
    const eventos = new Map();
    const principal = { style: {} };
    let recargas = 0;
    let responder;
    const location = { pathname: "/dashboard.html", hostname: "localhost", reload: () => { recargas++; } };
    const contexto = vm.createContext({
        location,
        window: { location, addEventListener: (nombre, callback) => eventos.set(nombre, callback) },
        document: { addEventListener() {}, querySelector: () => principal },
        localStorage: {
            getItem: clave => datos.get(clave) ?? null,
            removeItem: clave => datos.delete(clave)
        },
        fetch: ruta => {
            assert.match(ruta, /\/api\/dashboard\?clienteId=21$/);
            return new Promise(resolve => { responder = resolve; });
        }
    });
    for (const archivo of ["auth.js", "api.js"]) {
        vm.runInContext(readFileSync(resolve(__dirname, "../../js", archivo), "utf8"), contexto);
    }
    const enCurso = vm.runInContext('apiFetch("/dashboard")', contexto);
    datos.set("clienteActivo", seleccion(22));
    eventos.get("storage")({ key: "clienteActivo" });
    assert.equal(principal.style.visibility, "hidden");
    assert.equal(recargas, 1);
    responder({ ok: true, json: async () => ({ ingresos: "999.00" }) });
    await assert.rejects(enCurso, /selección del cliente cambió/);
    eventos.get("pageshow")({ persisted: true });
    assert.equal(recargas, 2);
});

test("chat descarta la conversación anterior y pausa el sondeo al ocultarse", async () => {
    function elemento() {
        return {
            children: [], dataset: {}, style: {}, classList: { add() {} },
            scrollTop: 0, scrollHeight: 0, clientHeight: 0,
            addEventListener() {},
            append(...hijos) { this.children.push(...hijos); },
            prepend(hijo) { this.children.unshift(hijo); },
            replaceChildren(...hijos) { this.children = hijos; },
            get firstElementChild() { return this.children[0]; },
            get lastElementChild() { return this.children.at(-1); },
            set textContent(texto) { this.texto = texto; this.children = []; }
        };
    }
    const nodos = new Map();
    const eventos = new Map();
    const pendientes = new Map();
    const get = id => {
        if (!nodos.has(id)) nodos.set(id, elemento());
        return nodos.get(id);
    };
    let cancelado;
    const documento = { getElementById: get, createElement: elemento, querySelector: () => elemento(), hidden: false,
        addEventListener: (nombre, funcion) => eventos.set(nombre, funcion) };
    const contexto = vm.createContext({
        document: documento,
        window: { addEventListener() {} },
        AbortController, URLSearchParams,
        setTimeout: () => 5,
        clearTimeout: id => { cancelado = id; },
        exigirSesion: () => ({ idUsuario: 1, nombre: "Prueba", rol: "Emprendedor" }),
        aplicarPermisosPorRol() {},
        mostrarNotificacion: mensaje => assert.fail(mensaje),
        apiFetch: (ruta, { signal } = {}) => {
            if (ruta === "/mensajes/contactos") return Promise.resolve([2, 3].map(idUsuario => ({
                idUsuario, nombre: `Contacto ${idUsuario}`, apellido: "Prueba", rol: "Emprendedor"
            })));
            const id = Number(ruta.match(/mensajes\/(\d+)/)[1]);
            return new Promise(resolve => pendientes.set(id, { resolve, signal }));
        }
    });
    vm.runInContext(readFileSync(resolve(__dirname, "../../js/mensajes.js"), "utf8"), contexto);
    await new Promise(setImmediate);
    const [a, b] = get("listaContactos").children;
    const anterior = a.onclick();
    const nueva = b.onclick();
    assert.ok(pendientes.get(2).signal.aborted);
    const mensaje = id => ({ registros: [
        { idMensaje: id, fechaEnvio: "2026-11-24 12:00:00", idEmisor: id, contenido: `Mensaje del contacto ${id}` }
    ], hayMas: false });
    pendientes.get(3).resolve(mensaje(3));
    await nueva;
    pendientes.get(2).resolve(mensaje(2));
    await anterior;
    assert.deepEqual(get("chatMensajes").children.map(n => n.children[0].texto), ["Mensaje del contacto 3"]);
    documento.hidden = true;
    eventos.get("visibilitychange")();
    assert.equal(cancelado, 5);
});
