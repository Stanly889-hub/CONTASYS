let sesionUsuario = exigirSesion();

const params = new URLSearchParams(window.location.search);
const tipoActual = params.get("tipo") === "egreso" ? "egreso" : "ingreso";
const nombreTipo = tipoActual === "ingreso" ? "Ingresos" : "Egresos";
const endpointBase = tipoActual === "ingreso" ? "/ingresos" : "/egresos";
const tituloFormulario = document.getElementById("tituloFormulario");
const formularioMovimiento = document.getElementById("movimientoForm");

let editandoId = null;
let guardandoMovimiento = false;
const navegarMovimientos = crearPaginador(document.querySelector(".cs-module-scroll"), cargarPaginaMovimientos);

async function iniciar() {
    if (!sesionUsuario) return;

    iniciarMarcoOperacion(sesionUsuario, nombreTipo.toLowerCase());
    document.body.dataset.tipoMovimiento = tipoActual;
    document.title = `${nombreTipo} | CONTASYS`;
    document.getElementById("tituloPagina").textContent = nombreTipo;
    document.getElementById("descripcionMovimiento").textContent = tipoActual === "ingreso"
        ? "Registra y administra las entradas de dinero de tu negocio"
        : "Registra y controla las salidas de dinero de tu negocio";
    const flecha = `css/iconos.svg#${tipoActual === "ingreso" ? "entrada" : "salida"}`;
    for (const icono of document.querySelectorAll(".cs-module-hero-mark use, .cs-module-kpi:not(.cs-module-kpi-pending) use")) {
        icono.setAttribute("href", flecha);
    }
    tituloFormulario.textContent = `Registrar ${tipoActual}`;
    document.getElementById("tituloTabla").textContent = `Historial de ${nombreTipo.toLowerCase()}`;
    document.getElementById("fecha").value = fechaLocalISO();

    try {
        await Promise.all([cargarCategorias(), cargarMetodosPago()]);
        await renderizarTabla();
    } catch (error) {
        estadoListado(error.message, "error");
        mostrarNotificacion(error.message, "error");
    }
}

async function cargarCategorias() {
    let categorias = await apiFetch(`/categorias?tipo=${tipoActual}`);
    let selectForm = document.getElementById("categoria");
    let selectFiltro = document.getElementById("filtroCategoria");

    categorias.forEach(cat => {
        let optForm = document.createElement("option");
        optForm.value = cat.idCategoria;
        optForm.textContent = cat.nombreCategoria;
        selectForm.appendChild(optForm);

        let optFiltro = document.createElement("option");
        optFiltro.value = cat.idCategoria;
        optFiltro.textContent = cat.nombreCategoria;
        selectFiltro.appendChild(optFiltro);
    });
}

async function cargarMetodosPago() {
    let metodos = await apiFetch("/metodos-pago");
    let select = document.getElementById("metodoPago");
    metodos.forEach(mp => {
        let opt = document.createElement("option");
        opt.value = mp.idMetodoPago;
        opt.textContent = mp.nombreMetodo;
        select.appendChild(opt);
    });
}

async function renderizarTabla() {
    let fechaDesde = document.getElementById("filtroFechaDesde").value;
    let fechaHasta = document.getElementById("filtroFechaHasta").value;
    let idCategoria = document.getElementById("filtroCategoria").value;

    let query = new URLSearchParams();
    query.set("catalogos", "1");
    if (fechaDesde) query.set("fechaDesde", fechaDesde);
    if (fechaHasta) query.set("fechaHasta", fechaHasta);
    if (idCategoria) query.set("idCategoria", idCategoria);

    return navegarMovimientos(`${endpointBase}?${query}`);
}

async function cargarPaginaMovimientos(ruta, signal) {
    estadoListado("Cargando movimientos…", "carga");
    let datos;
    try {
        datos = await apiFetch(ruta, { signal });
    } catch (error) {
        if (!signal.aborted) estadoListado(error.message, "error");
        throw error;
    }
    if (signal.aborted) return;
    const { registros: movimientos, siguiente, totales, categoriasHistoricas = [] } = datos;
    let tabla = document.getElementById("tablaMovimientos");
    tabla.innerHTML = "";
    const filtroCategoria = document.getElementById("filtroCategoria");
    for (const cat of categoriasHistoricas) {
        if (![...filtroCategoria.options].some(opcion => opcion.value === String(cat.idCategoria))) {
            filtroCategoria.add(new Option(`${cat.categoria} (inactiva)`, cat.idCategoria));
        }
    }

    if (movimientos.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 7;
        celda.className = "cs-table-empty";
        celda.textContent = "No hay movimientos que coincidan.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
    }

    movimientos.forEach(m => {
        if (![...filtroCategoria.options].some(opcion => opcion.value === String(m.idCategoria))) {
            filtroCategoria.add(new Option(`${m.categoria} (inactiva)`, m.idCategoria));
        }
        let fila = document.createElement("tr");

        [m.fecha, m.descripcion, formatoCOP(m.monto), m.estadoTransaccion, m.categoria, m.metodoPago].forEach((valor, indice) => {
            let td = document.createElement("td");
            if (indice === 3) {
                const etiqueta = document.createElement("span");
                etiqueta.className = "cs-pill cs-module-state";
                etiqueta.dataset.estado = valor;
                etiqueta.textContent = valor;
                td.appendChild(etiqueta);
            } else {
                td.textContent = valor;
            }
            fila.appendChild(td);
        });

        let celdaAcciones = document.createElement("td");
        celdaAcciones.append(botonesOperacion(() => editarMovimiento(m), () => eliminarMovimientoUI(m.id)));
        fila.appendChild(celdaAcciones);
        tabla.appendChild(fila);
    });

    document.getElementById("importeConfirmado").textContent = formatoCOP(totales.confirmado);
    document.getElementById("importePendiente").textContent = formatoCOP(totales.pendiente);
    document.getElementById("totalFiltrado").hidden = false;
    estadoListado("");
    return siguiente;
}

formularioMovimiento.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (guardandoMovimiento) return;
    avisoFormulario(this);

    let datos = {
        monto: document.getElementById("monto").value,
        descripcion: document.getElementById("desc").value.trim(),
        fecha: document.getElementById("fecha").value,
        idCategoria: Number(document.getElementById("categoria").value),
        idMetodoPago: Number(document.getElementById("metodoPago").value),
        estadoTransaccion: document.getElementById("estadoTransaccion").value
    };

    if (!datos.monto || datos.monto <= 0) {
        avisoFormulario(this, "El monto debe ser mayor a cero");
        return;
    }
    if (!datos.descripcion || !datos.fecha || !datos.idCategoria || !datos.idMetodoPago) {
        avisoFormulario(this, "Completa todos los campos");
        return;
    }

    guardandoMovimiento = true;
    document.getElementById("btnGuardar").disabled = true;
    try {
        if (editandoId) {
            await apiFetch(`${endpointBase}/${editandoId}`, { method: "PUT", body: JSON.stringify(datos) });
            mostrarNotificacion("Movimiento actualizado", "ok");
            cancelarEdicion();
        } else {
            await apiFetch(endpointBase, { method: "POST", body: JSON.stringify(datos) });
            mostrarNotificacion(`${nombreTipo.slice(0, -1)} registrado`, "ok");
            this.reset();
            document.getElementById("fecha").value = fechaLocalISO();
        }
        renderizarTabla();
    } catch (error) {
        avisoFormulario(this, error.message);
    } finally {
        guardandoMovimiento = false;
        document.getElementById("btnGuardar").disabled = false;
    }
});

function editarMovimiento(m) {
    avisoFormulario(formularioMovimiento);
    editandoId = m.id;
    document.getElementById("monto").value = m.monto;
    document.getElementById("fecha").value = m.fecha;
    document.getElementById("desc").value = m.descripcion;
    seleccionarCatalogoHistorico(document.getElementById("categoria"), m.idCategoria, m.categoria);
    seleccionarCatalogoHistorico(document.getElementById("metodoPago"), m.idMetodoPago, m.metodoPago);
    document.getElementById("estadoTransaccion").value = m.estadoTransaccion;

    document.getElementById("btnGuardar").textContent = "Actualizar";
    document.getElementById("btnCancelar").style.display = "inline-block";
    enfocarEdicion(tituloFormulario, `Editar ${tipoActual}`);
}

function cancelarEdicion() {
    editandoId = null;
    avisoFormulario(formularioMovimiento);
    tituloFormulario.textContent = `Registrar ${tipoActual}`;
    document.getElementById("movimientoForm").reset();
    document.querySelectorAll("#movimientoForm [data-historico]").forEach(opcion => opcion.remove());
    document.getElementById("fecha").value = fechaLocalISO();
    document.getElementById("btnGuardar").textContent = "Guardar";
    document.getElementById("btnCancelar").style.display = "none";
}

async function eliminarMovimientoUI(id) {
    const confirmado = await confirmarEliminacion("¿Seguro que deseas eliminar este movimiento?");
    if (!confirmado) return;

    try {
        await apiFetch(`${endpointBase}/${id}`, { method: "DELETE" });
        mostrarNotificacion("Movimiento eliminado", "ok");
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.status === 500
            ? "No se pudo eliminar el movimiento. Pide al administrador que revise la compatibilidad del esquema financiero."
            : error.message, "error");
    }
}

function aplicarFiltros() { renderizarTabla(); }
function limpiarFiltros() {
    document.getElementById("filtroFechaDesde").value = "";
    document.getElementById("filtroFechaHasta").value = "";
    document.getElementById("filtroCategoria").value = "";
    renderizarTabla();
}

iniciar();
