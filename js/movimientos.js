let sesionUsuario = exigirSesion();

const params = new URLSearchParams(window.location.search);
const tipoActual = params.get("tipo") === "egreso" ? "egreso" : "ingreso";
const nombreTipo = tipoActual === "ingreso" ? "Ingresos" : "Egresos";
const endpointBase = tipoActual === "ingreso" ? "/ingresos" : "/egresos";

let editandoId = null;

async function iniciar() {
    if (!sesionUsuario) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);

    let paginaActiva = tipoActual === "ingreso" ? "ingresos" : "egresos";
    document.querySelector(`[data-page="${paginaActiva}"]`).classList.add("active");

    document.getElementById("tituloPagina").textContent = nombreTipo;
    document.getElementById("tituloFormulario").textContent = `Registrar ${nombreTipo.toLowerCase()}`;
    document.getElementById("tituloTabla").textContent = nombreTipo;
    document.getElementById("fecha").value = new Date().toISOString().slice(0, 10);

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
    if (fechaDesde) query.set("fechaDesde", fechaDesde);
    if (fechaHasta) query.set("fechaHasta", fechaHasta);
    if (idCategoria) query.set("idCategoria", idCategoria);

    let movimientos;
    try {
        movimientos = await apiFetch(`${endpointBase}?${query.toString()}`);
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    let tabla = document.getElementById("tablaMovimientos");
    tabla.innerHTML = "";
    let total = 0;

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
        total += Number(m.monto);
        let fila = document.createElement("tr");

        [m.fecha, m.categoria, m.metodoPago, m.descripcion, formatoCOP(m.monto)].forEach(valor => {
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

    document.getElementById("totalFiltrado").textContent = `Total: ${formatoCOP(total)}`;
}

document.getElementById("movimientoForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    let datos = {
        monto: Number(document.getElementById("monto").value),
        descripcion: document.getElementById("desc").value.trim(),
        fecha: document.getElementById("fecha").value,
        idCategoria: Number(document.getElementById("categoria").value),
        idMetodoPago: Number(document.getElementById("metodoPago").value)
    };

    if (!datos.monto || datos.monto <= 0) {
        mostrarNotificacion("El monto debe ser mayor a cero", "error");
        return;
    }
    if (!datos.descripcion || !datos.fecha || !datos.idCategoria || !datos.idMetodoPago) {
        mostrarNotificacion("Completa todos los campos", "error");
        return;
    }

    try {
        if (editandoId) {
            await apiFetch(`${endpointBase}/${editandoId}`, { method: "PUT", body: JSON.stringify(datos) });
            mostrarNotificacion("Movimiento actualizado", "ok");
            cancelarEdicion();
        } else {
            await apiFetch(endpointBase, { method: "POST", body: JSON.stringify(datos) });
            mostrarNotificacion(`${nombreTipo.slice(0, -1)} registrado`, "ok");
            this.reset();
            document.getElementById("fecha").value = new Date().toISOString().slice(0, 10);
        }
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
});

function editarMovimiento(m) {
    editandoId = m.id;
    document.getElementById("monto").value = m.monto;
    document.getElementById("fecha").value = m.fecha;
    document.getElementById("desc").value = m.descripcion;
    document.getElementById("categoria").value = m.idCategoria;
    document.getElementById("metodoPago").value = m.idMetodoPago;

    document.getElementById("btnGuardar").textContent = "Actualizar";
    document.getElementById("btnCancelar").style.display = "inline-block";
    document.getElementById("tituloFormulario").scrollIntoView({ behavior: "smooth" });
}

function cancelarEdicion() {
    editandoId = null;
    document.getElementById("movimientoForm").reset();
    document.getElementById("fecha").value = new Date().toISOString().slice(0, 10);
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