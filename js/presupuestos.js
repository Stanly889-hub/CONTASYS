// Lógica de la página de presupuestos (presupuestos.html)

let sesionActual = exigirSesion();
let editandoId = null;
let alertasYaMostradas = new Set();

function primerDiaDelMes() {
    let d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function ultimoDiaDelMes() {
    let d = new Date();
    let ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`;
}

function iniciar() {
    if (!sesionActual) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionActual.nombre} (${sesionActual.rol})`;
    aplicarPermisosPorRol(sesionActual.rol);
    document.querySelector('[data-page="presupuestos"]').classList.add("active");

    cargarCategorias();
    document.getElementById("fechaInicio").value = primerDiaDelMes();
    document.getElementById("fechaFin").value = ultimoDiaDelMes();
    renderizarTabla();
}

function cargarCategorias() {
    let select = document.getElementById("categoria");

    let gIngreso = document.createElement("optgroup");
    gIngreso.label = "Categorías de Ingreso";
    obtenerCategorias('ingreso').forEach(c => {
        let opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        gIngreso.appendChild(opt);
    });

    let gEgreso = document.createElement("optgroup");
    gEgreso.label = "Categorías de Egreso";
    obtenerCategorias('egreso').forEach(c => {
        let opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        gEgreso.appendChild(opt);
    });

    select.append(gIngreso, gEgreso);
}

document.getElementById("presupuestoForm").addEventListener("submit", function (e) {
    e.preventDefault();

    let datos = {
        nombrePresupuesto: document.getElementById("nombrePresupuesto").value.trim(),
        categoria: document.getElementById("categoria").value,
        montoPresupuesto: Number(document.getElementById("montoPresupuesto").value),
        fechaInicio: document.getElementById("fechaInicio").value,
        fechaFin: document.getElementById("fechaFin").value
    };

    if (!datos.nombrePresupuesto || !datos.categoria || !datos.fechaInicio || !datos.fechaFin) {
        mostrarNotificacion("Completa todos los campos", "error");
        return;
    }
    if (!datos.montoPresupuesto || datos.montoPresupuesto <= 0) {
        mostrarNotificacion("El monto debe ser mayor a cero", "error");
        return;
    }
    if (datos.fechaInicio > datos.fechaFin) {
        mostrarNotificacion("La fecha inicial no puede ser mayor que la final", "error");
        return;
    }

    if (editandoId) {
        actualizarPresupuesto(editandoId, datos);
        mostrarNotificacion("Presupuesto actualizado", "ok");
        cancelarEdicion();
    } else {
        guardarPresupuesto(datos);
        mostrarNotificacion("Presupuesto creado", "ok");
        this.reset();
        document.getElementById("fechaInicio").value = primerDiaDelMes();
        document.getElementById("fechaFin").value = ultimoDiaDelMes();
    }

    renderizarTabla();
});

function renderizarTabla() {
    let presupuestos = obtenerPresupuestos();
    let tabla = document.getElementById("tablaPresupuestos");
    tabla.innerHTML = "";

    if (presupuestos.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.colSpan = 7;
        celda.style.textAlign = "center";
        celda.textContent = "Aún no tienes presupuestos registrados.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    presupuestos.forEach(p => {
        let ejecutado = calcularEjecutadoPresupuesto(p);
        let porcentaje = p.montoPresupuesto > 0 ? Math.round((ejecutado / p.montoPresupuesto) * 100) : 0;
        let excedido = ejecutado > p.montoPresupuesto;

        let fila = document.createElement("tr");
        if (excedido) fila.classList.add("fila-excedida");

        let celdaNombre = document.createElement("td");
        celdaNombre.textContent = p.nombrePresupuesto;

        let celdaCategoria = document.createElement("td");
        celdaCategoria.textContent = p.categoria;

        let celdaPeriodo = document.createElement("td");
        celdaPeriodo.textContent = `${p.fechaInicio} a ${p.fechaFin}`;

        let celdaPresupuestado = document.createElement("td");
        celdaPresupuestado.textContent = formatoCOP(p.montoPresupuesto);

        let celdaEjecutado = document.createElement("td");
        celdaEjecutado.textContent = formatoCOP(ejecutado);
        if (excedido) celdaEjecutado.style.color = "#ff4d4d";

        let celdaProgreso = document.createElement("td");
        let barraContenedor = document.createElement("div");
        barraContenedor.className = "barra-contenedor";
        let barra = document.createElement("div");
        barra.className = "barra-progreso" + (excedido ? " excedido" : "");
        barra.style.width = Math.min(porcentaje, 100) + "%";
        barraContenedor.appendChild(barra);
        let textoPorcentaje = document.createElement("span");
        textoPorcentaje.className = "texto-porcentaje";
        textoPorcentaje.textContent = (excedido ? "⚠ " : "") + porcentaje + "%";
        celdaProgreso.append(barraContenedor, textoPorcentaje);

        let celdaAcciones = document.createElement("td");
        let btnEditar = document.createElement("button");
        btnEditar.textContent = "Editar";
        btnEditar.className = "btn-accion btn-editar";
        btnEditar.onclick = () => editarPresupuesto(p.id);
        let btnEliminar = document.createElement("button");
        btnEliminar.textContent = "Eliminar";
        btnEliminar.className = "btn-accion btn-eliminar";
        btnEliminar.onclick = () => eliminarPresupuestoUI(p.id);
        celdaAcciones.append(btnEditar, btnEliminar);

        fila.append(celdaNombre, celdaCategoria, celdaPeriodo, celdaPresupuestado, celdaEjecutado, celdaProgreso, celdaAcciones);
        tabla.appendChild(fila);

        if (excedido) mostrarAlertaExcedido(p.nombrePresupuesto);
    });
}

function mostrarAlertaExcedido(nombre) {
    if (alertasYaMostradas.has(nombre)) return;
    alertasYaMostradas.add(nombre);
    mostrarNotificacion(`⚠ El presupuesto "${nombre}" fue excedido`, "error");
}

function editarPresupuesto(id) {
    let p = obtenerPresupuestos().find(p => p.id === id);
    if (!p) return;

    editandoId = id;
    document.getElementById("nombrePresupuesto").value = p.nombrePresupuesto;
    document.getElementById("categoria").value = p.categoria;
    document.getElementById("montoPresupuesto").value = p.montoPresupuesto;
    document.getElementById("fechaInicio").value = p.fechaInicio;
    document.getElementById("fechaFin").value = p.fechaFin;

    document.getElementById("btnGuardarPresupuesto").textContent = "Actualizar";
    document.getElementById("btnCancelarPresupuesto").style.display = "inline-block";
}

function cancelarEdicion() {
    editandoId = null;
    document.getElementById("presupuestoForm").reset();
    document.getElementById("fechaInicio").value = primerDiaDelMes();
    document.getElementById("fechaFin").value = ultimoDiaDelMes();
    document.getElementById("btnGuardarPresupuesto").textContent = "Guardar";
    document.getElementById("btnCancelarPresupuesto").style.display = "none";
}

function eliminarPresupuestoUI(id) {
    let confirmado = confirm("¿Seguro que deseas eliminar este presupuesto?");
    if (!confirmado) return;

    eliminarPresupuesto(id);
    mostrarNotificacion("Presupuesto eliminado", "ok");
    renderizarTabla();
}

iniciar();