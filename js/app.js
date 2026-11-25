function formatoCOP(monto) {
    if (typeof monto === "string" && /^-?\d+(?:\.\d{1,2})?$/.test(monto)) {
        const valor = centavosCOP(monto);
        const absoluto = valor < 0n ? -valor : valor;
        const redondeado = (absoluto + 50n) / 100n;
        monto = valor < 0n ? -redondeado : redondeado;
    }
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(monto);
}

function centavosCOP(monto) {
    const [entero, fraccion = ""] = String(monto).replace(/^-/, "").split(".");
    const total = BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, "0"));
    return String(monto).startsWith("-") ? -total : total;
}

function formatoCOPExacto(monto) {
    const valor = centavosCOP(monto);
    const absoluto = valor < 0n ? -valor : valor;
    const entero = (valor < 0n ? -absoluto : absoluto) / 100n;
    const fraccion = String(absoluto % 100n).padStart(2, "0");
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 })
        .formatToParts(valor < 0n && entero === 0n ? -0 : entero)
        .map(parte => parte.type === "fraction" ? fraccion : parte.value).join("");
}

function textoPendientes(pendientes) {
    return `Pendientes · Ingresos: ${formatoCOP(pendientes.ingresos)} · Egresos: ${formatoCOP(pendientes.egresos)}`;
}

function fechaLocalISO() {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function seleccionarCatalogoHistorico(select, id, nombre) {
    select.querySelectorAll("[data-historico]").forEach(opcion => opcion.remove());
    if (![...select.options].some(opcion => opcion.value === String(id))) {
        const opcion = new Option(`${nombre} (inactivo)`, id);
        opcion.dataset.historico = "";
        select.add(opcion);
    }
    select.value = id;
}

function mostrarNotificacion(mensaje, tipo) {
    let div = document.createElement("div");
    div.className = "notificacion " + tipo;
    div.textContent = mensaje;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}
function crearPaginador(ancla, cargar, limite = 50) {
    const contenedor = document.createElement("div");
    contenedor.className = "btn-group";
    const anterior = document.createElement("button");
    const siguiente = document.createElement("button");
    const estado = document.createElement("span");
    estado.setAttribute("role", "status");
    anterior.textContent = "Anterior";
    siguiente.textContent = "Siguiente";
    anterior.type = siguiente.type = "button";
    anterior.disabled = siguiente.disabled = true;
    contenedor.append(anterior, siguiente, estado);
    ancla.after(contenedor);
    let ruta = "";
    let cursores = [null];
    let proximo = null;
    let peticion;
    async function mostrar(destino, pila) {
        peticion?.abort();
        const actual = new AbortController();
        peticion = actual;
        const consulta = new URLSearchParams({ limite });
        const cursor = pila.at(-1);
        if (cursor) consulta.set("cursor", cursor);
        estado.textContent = "Cargando…";
        anterior.disabled = siguiente.disabled = true;
        try {
            const resultado = await cargar(destino + (destino.includes("?") ? "&" : "?") + consulta, actual.signal);
            if (actual.signal.aborted) return;
            ruta = destino;
            cursores = pila;
            proximo = resultado;
            estado.textContent = `Página ${pila.length}`;
        } catch (error) {
            if (!actual.signal.aborted) {
                estado.textContent = "No se pudo cargar la página";
                mostrarNotificacion(error.message, "error");
            }
        } finally {
            if (peticion === actual) {
                anterior.disabled = cursores.length <= 1;
                siguiente.disabled = !proximo;
            }
        }
    }
    anterior.onclick = () => mostrar(ruta, cursores.slice(0, -1));
    siguiente.onclick = () => mostrar(ruta, [...cursores, proximo]);
    return destino => mostrar(destino, [null]);
}
