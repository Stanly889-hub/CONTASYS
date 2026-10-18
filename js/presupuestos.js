let sesionUsuario = exigirSesion();
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

async function iniciar() {
    if (!sesionUsuario) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="presupuestos"]').classList.add("active");

    document.getElementById("fechaInicio").value = primerDiaDelMes();
    document.getElementById("fechaFin").value = ultimoDiaDelMes();

    try {
        await cargarCategorias();
        await renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

async function cargarCategorias() {
    let categorias = await apiFetch("/categorias");
    let select = document.getElementById("categoria");

    let gIngreso = document.createElement("optgroup");
    gIngreso.label = "Categorías de Ingreso";
    let gEgreso = document.createElement("optgroup");
    gEgreso.label = "Categorías de Egreso";

    categorias.forEach(cat => {
        let opt = document.createElement("option");
        opt.value = cat.idCategoria;
        opt.textContent = cat.nombreCategoria;
        (cat.tipo === "Ingreso" ? gIngreso : gEgreso).appendChild(opt);
    });

    select.append(gIngreso, gEgreso);
}

document.getElementById("presupuestoForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    let datos = {
        nombrePresupuesto: document.getElementById("nombrePresupuesto").value.trim(),
        idCategoria: Number(document.getElementById("categoria").value),
        montoPresupuesto: Number(document.getElementById("montoPresupuesto").value),
        fechaInicio: document.getElementById("fechaInicio").value,
        fechaFin: document.getElementById("fechaFin").value
    };

    if (!datos.nombrePresupuesto || !datos.idCategoria || !datos.fechaInicio || !datos.fechaFin) {
        mostrarNotificacion("Completa todos los campos", "error");
        return;
    }
    if (!datos.montoPresupuesto || datos.montoPresupuesto <= 0) {
        mostrarNotificacion("El monto debe ser mayor a cero", "error");
        return;
    }

    try {
        if (editandoId) {
            await apiFetch(`/presupuestos/${editandoId}`, { method: "PUT", body: JSON.stringify(datos) });
            mostrarNotificacion("Presupuesto actualizado", "ok");
            cancelarEdicion();
        } else {
            await apiFetch("/presupuestos", { method: "POST", body: JSON.stringify(datos) });
            mostrarNotificacion("Presupuesto creado", "ok");
            this.reset();
            document.getElementById("fechaInicio").value = primerDiaDelMes();
            document.getElementById("fechaFin").value = ultimoDiaDelMes();
        }
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
});

async function renderizarTabla() {
    let presupuestos;
    try {
        presupuestos = await apiFetch("/presupuestos");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

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
        let ejecutado = Number(p.ejecutado);
        let fila = document.createElement("tr");
        if (p.excedido) fila.classList.add("fila-excedida");

        [p.nombrePresupuesto, p.categoria, `${p.fechaInicio} a ${p.fechaFin}`, formatoCOP(p.montoPresupuesto), formatoCOP(ejecutado)]
            .forEach(valor => {
                let td = document.createElement("td");
                td.textContent = valor;
                fila.appendChild(td);
            });

        let celdaProgreso = document.createElement("td");
        let barraContenedor = document.createElement("div");
        barraContenedor.className = "barra-contenedor";
        let barra = document.createElement("div");
        barra.className = "barra-progreso" + (p.excedido ? " excedido" : "");
        barra.style.width = Math.min(p.porcentaje, 100) + "%";
        barraContenedor.appendChild(barra);
        let textoPorcentaje = document.createElement("span");
        textoPorcentaje.className = "texto-porcentaje";
        textoPorcentaje.textContent = (p.excedido ? "⚠ " : "") + p.porcentaje + "%";
        celdaProgreso.append(barraContenedor, textoPorcentaje);
        fila.appendChild(celdaProgreso);

        let celdaAcciones = document.createElement("td");
        let btnEditar = document.createElement("button");
        btnEditar.textContent = "Editar";
        btnEditar.className = "btn-accion btn-editar";
        btnEditar.onclick = () => editarPresupuesto(p);
        let btnEliminar = document.createElement("button");
        btnEliminar.textContent = "Eliminar";
        btnEliminar.className = "btn-accion btn-eliminar";
        btnEliminar.onclick = () => eliminarPresupuestoUI(p.idPresupuesto);
        celdaAcciones.append(btnEditar, btnEliminar);
        fila.appendChild(celdaAcciones);

        tabla.appendChild(fila);

        if (p.excedido) mostrarAlertaExcedido(p.nombrePresupuesto);
    });
}

function mostrarAlertaExcedido(nombre) {
    if (alertasYaMostradas.has(nombre)) return;
    alertasYaMostradas.add(nombre);
    mostrarNotificacion(`⚠ El presupuesto "${nombre}" fue excedido`, "error");
}

function editarPresupuesto(p) {
    editandoId = p.idPresupuesto;
    document.getElementById("nombrePresupuesto").value = p.nombrePresupuesto;
    document.getElementById("categoria").value = p.idCategoria;
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

async function eliminarPresupuestoUI(id) {
    let confirmado = confirm("¿Seguro que deseas eliminar este presupuesto?");
    if (!confirmado) return;

    try {
        await apiFetch(`/presupuestos/${id}`, { method: "DELETE" });
        mostrarNotificacion("Presupuesto eliminado", "ok");
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

iniciar();