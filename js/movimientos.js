let sesionUsuario = exigirSesion();

const params = new URLSearchParams(window.location.search);
const tipoActual = params.get("tipo") === "egreso" ? "egreso" : "ingreso";
const nombreTipo = tipoActual === "ingreso" ? "Ingresos" : "Egresos";
const endpointBase = tipoActual === "ingreso" ? "/ingresos" : "/egresos";

let editandoId = null;
let guardandoMovimiento = false;
const navegarMovimientos = crearPaginador(document.getElementById("tablaMovimientos").closest("table"), cargarPaginaMovimientos);

async function iniciar() {
    if (!sesionUsuario) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);

    let paginaActiva = tipoActual === "ingreso" ? "ingresos" : "egresos";
    document.querySelector(`[data-page="${paginaActiva}"]`).classList.add("active");

    document.getElementById("tituloPagina").textContent = nombreTipo;
    document.getElementById("tituloFormulario").textContent = `Registrar ${nombreTipo.toLowerCase()}`;
    document.getElementById("tituloTabla").textContent = nombreTipo;
    document.getElementById("fecha").value = fechaLocalISO();

    try {
        await cargarCategorias();
        await cargarMetodosPago();
        await renderizarTabla();
    } catch (error) {
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
    const { registros: movimientos, siguiente, totales, categoriasHistoricas = [] } = await apiFetch(ruta, { signal });
    if (signal.aborted) return;
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
        celda.colSpan = 6;
        celda.style.textAlign = "center";
        celda.textContent = "No hay movimientos que coincidan.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
    }

    movimientos.forEach(m => {
        if (![...filtroCategoria.options].some(opcion => opcion.value === String(m.idCategoria))) {
            filtroCategoria.add(new Option(`${m.categoria} (inactiva)`, m.idCategoria));
        }
        let fila = document.createElement("tr");

        [m.fecha, m.categoria, m.metodoPago, m.descripcion, `${formatoCOP(m.monto)} · ${m.estadoTransaccion}`].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });

        let celdaAcciones = document.createElement("td");
        let btnEditar = document.createElement("button");
        btnEditar.textContent = "Editar";
        btnEditar.className = "btn-accion btn-editar";
        btnEditar.onclick = () => editarMovimiento(m);

        let btnEliminar = document.createElement("button");
        btnEliminar.textContent = "Eliminar";
        btnEliminar.className = "btn-accion btn-eliminar";
        btnEliminar.onclick = () => eliminarMovimientoUI(m.id);

        celdaAcciones.append(btnEditar, btnEliminar);
        fila.appendChild(celdaAcciones);
        tabla.appendChild(fila);
    });

    document.getElementById("totalFiltrado").textContent =
        `Confirmado: ${formatoCOP(totales.confirmado)} · Pendiente: ${formatoCOP(totales.pendiente)}`;
    return siguiente;
}

document.getElementById("movimientoForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (guardandoMovimiento) return;

    let datos = {
        monto: document.getElementById("monto").value,
        descripcion: document.getElementById("desc").value.trim(),
        fecha: document.getElementById("fecha").value,
        idCategoria: Number(document.getElementById("categoria").value),
        idMetodoPago: Number(document.getElementById("metodoPago").value),
        estadoTransaccion: document.getElementById("estadoTransaccion").value
    };

    if (!datos.monto || datos.monto <= 0) {
        mostrarNotificacion("El monto debe ser mayor a cero", "error");
        return;
    }
    if (!datos.descripcion || !datos.fecha || !datos.idCategoria || !datos.idMetodoPago) {
        mostrarNotificacion("Completa todos los campos", "error");
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
        mostrarNotificacion(error.message, "error");
    } finally {
        guardandoMovimiento = false;
        document.getElementById("btnGuardar").disabled = false;
    }
});

function editarMovimiento(m) {
    editandoId = m.id;
    document.getElementById("monto").value = m.monto;
    document.getElementById("fecha").value = m.fecha;
    document.getElementById("desc").value = m.descripcion;
    seleccionarCatalogoHistorico(document.getElementById("categoria"), m.idCategoria, m.categoria);
    seleccionarCatalogoHistorico(document.getElementById("metodoPago"), m.idMetodoPago, m.metodoPago);
    document.getElementById("estadoTransaccion").value = m.estadoTransaccion;

    document.getElementById("btnGuardar").textContent = "Actualizar";
    document.getElementById("btnCancelar").style.display = "inline-block";
    document.getElementById("tituloFormulario").scrollIntoView({ behavior: "smooth" });
}

function cancelarEdicion() {
    editandoId = null;
    document.getElementById("movimientoForm").reset();
    document.querySelectorAll("#movimientoForm [data-historico]").forEach(opcion => opcion.remove());
    document.getElementById("fecha").value = fechaLocalISO();
    document.getElementById("btnGuardar").textContent = "Guardar";
    document.getElementById("btnCancelar").style.display = "none";
}

async function eliminarMovimientoUI(id) {
    let confirmado = confirm("¿Seguro que deseas eliminar este movimiento?");
    if (!confirmado) return;

    try {
        await apiFetch(`${endpointBase}/${id}`, { method: "DELETE" });
        mostrarNotificacion("Movimiento eliminado", "ok");
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
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
