// Lógica de la página de movimientos (movimientos.html)
// Se reutiliza para Ingresos y Egresos: el tipo se define en la URL,
// por ejemplo movimientos.html?tipo=ingreso

let sesionActual = exigirSesion();

const params = new URLSearchParams(window.location.search);
const tipoActual = params.get("tipo") === "egreso" ? "egreso" : "ingreso";
const nombreTipo = tipoActual === "ingreso" ? "Ingresos" : "Egresos";

let editandoId = null;

function iniciar() {
    if (!sesionActual) return;

    document.getElementById("nombreUsuarioActual").textContent =
        `${sesionActual.nombre} (${sesionActual.rol})`;
    aplicarPermisosPorRol(sesionActual.rol);

    let paginaActiva = tipoActual === "ingreso" ? "ingresos" : "egresos";
    document.querySelector(`[data-page="${paginaActiva}"]`).classList.add("active");

    document.getElementById("tituloPagina").textContent = nombreTipo;
    document.getElementById("tituloFormulario").textContent = `Registrar ${nombreTipo.toLowerCase()}`;
    document.getElementById("tituloTabla").textContent = nombreTipo;

    document.getElementById("fecha").value = new Date().toISOString().slice(0, 10);

    cargarCategorias();
    cargarMetodosPago();
    renderizarTabla();
}

function cargarCategorias() {
    let categorias = obtenerCategorias(tipoActual);

    let selectForm = document.getElementById("categoria");
    let selectFiltro = document.getElementById("filtroCategoria");

    categorias.forEach(cat => {
        let optForm = document.createElement("option");
        optForm.value = cat;
        optForm.textContent = cat;
        selectForm.appendChild(optForm);

        let optFiltro = document.createElement("option");
        optFiltro.value = cat;
        optFiltro.textContent = cat;
        selectFiltro.appendChild(optFiltro);
    });
}

function cargarMetodosPago() {
    let select = document.getElementById("metodoPago");
    obtenerMetodosPago().forEach(mp => {
        let opt = document.createElement("option");
        opt.value = mp;
        opt.textContent = mp;
        select.appendChild(opt);
    });
}

function renderizarTabla() {
    let fechaDesde = document.getElementById("filtroFechaDesde").value || null;
    let fechaHasta = document.getElementById("filtroFechaHasta").value || null;
    let categoria = document.getElementById("filtroCategoria").value || null;

    let movimientos = filtrarMovimientos(tipoActual, fechaDesde, fechaHasta, categoria)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));

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
        total += m.monto;

        let fila = document.createElement("tr");

        let celdaFecha = document.createElement("td");
        celdaFecha.textContent = m.fecha;

        let celdaCategoria = document.createElement("td");
        celdaCategoria.textContent = m.categoria;

        let celdaMetodo = document.createElement("td");
        celdaMetodo.textContent = m.metodoPago;

        let celdaDesc = document.createElement("td");
        celdaDesc.textContent = m.descripcion;

        let celdaMonto = document.createElement("td");
        celdaMonto.textContent = formatoCOP(m.monto);

        let celdaAcciones = document.createElement("td");

        let btnEditar = document.createElement("button");
        btnEditar.textContent = "Editar";
        btnEditar.className = "btn-accion btn-editar";
        btnEditar.onclick = () => editarMovimiento(m.id);

        let btnEliminar = document.createElement("button");
        btnEliminar.textContent = "Eliminar";
        btnEliminar.className = "btn-accion btn-eliminar";
        btnEliminar.onclick = () => eliminarMovimientoUI(m.id);

        celdaAcciones.append(btnEditar, btnEliminar);

        fila.append(celdaFecha, celdaCategoria, celdaMetodo, celdaDesc, celdaMonto, celdaAcciones);
        tabla.appendChild(fila);
    });

    document.getElementById("totalFiltrado").textContent = `Total: ${formatoCOP(total)}`;
}

document.getElementById("movimientoForm").addEventListener("submit", function (e) {
    e.preventDefault();

    let datos = {
        tipo: tipoActual,
        monto: Number(document.getElementById("monto").value),
        descripcion: document.getElementById("desc").value.trim(),
        fecha: document.getElementById("fecha").value,
        categoria: document.getElementById("categoria").value,
        metodoPago: document.getElementById("metodoPago").value
    };

    if (!datos.monto || datos.monto <= 0) {
        mostrarNotificacion("El monto debe ser mayor a cero", "error");
        return;
    }

    if (!datos.descripcion || !datos.fecha || !datos.categoria || !datos.metodoPago) {
        mostrarNotificacion("Completa todos los campos", "error");
        return;
    }

    if (editandoId) {
        actualizarMovimiento(editandoId, datos);
        mostrarNotificacion("Movimiento actualizado", "ok");
        cancelarEdicion();
    } else {
        guardarMovimiento(datos);
        mostrarNotificacion(`${nombreTipo.slice(0, -1)} registrado`, "ok");
        this.reset();
        document.getElementById("fecha").value = new Date().toISOString().slice(0, 10);
    }

    renderizarTabla();
});

function editarMovimiento(id) {
    let movimiento = obtenerMovimientos().find(m => m.id === id);
    if (!movimiento) return;

    editandoId = id;

    document.getElementById("monto").value = movimiento.monto;
    document.getElementById("fecha").value = movimiento.fecha;
    document.getElementById("desc").value = movimiento.descripcion;
    document.getElementById("categoria").value = movimiento.categoria;
    document.getElementById("metodoPago").value = movimiento.metodoPago;

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

function eliminarMovimientoUI(id) {
    let confirmado = confirm("¿Seguro que deseas eliminar este movimiento? Esta acción no se puede deshacer.");
    if (!confirmado) return;

    eliminarMovimiento(id);
    mostrarNotificacion("Movimiento eliminado", "ok");
    renderizarTabla();
}

function aplicarFiltros() {
    renderizarTabla();
}

function limpiarFiltros() {
    document.getElementById("filtroFechaDesde").value = "";
    document.getElementById("filtroFechaHasta").value = "";
    document.getElementById("filtroCategoria").value = "";
    renderizarTabla();
}

iniciar();