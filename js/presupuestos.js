let sesionUsuario = exigirSesion();
let editandoId = null;
let guardandoPresupuesto = false;
let peticionPresupuestos;
const formularioPresupuesto = document.getElementById("presupuestoForm");
const tituloFormulario = document.getElementById("tituloFormulario");

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

    iniciarMarcoOperacion(sesionUsuario, "presupuestos");

    document.getElementById("fechaInicio").value = primerDiaDelMes();
    document.getElementById("fechaFin").value = ultimoDiaDelMes();

    try {
        await cargarCategorias();
        await renderizarTabla();
    } catch (error) {
        estadoListado(error.message, "error");
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

formularioPresupuesto.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (guardandoPresupuesto) return;
    avisoFormulario(this);

    let datos = {
        nombrePresupuesto: document.getElementById("nombrePresupuesto").value.trim(),
        idCategoria: Number(document.getElementById("categoria").value),
        montoPresupuesto: document.getElementById("montoPresupuesto").value,
        fechaInicio: document.getElementById("fechaInicio").value,
        fechaFin: document.getElementById("fechaFin").value,
        estado: document.getElementById("estadoPresupuesto").value
    };

    if (!datos.nombrePresupuesto || !datos.idCategoria || !datos.fechaInicio || !datos.fechaFin) {
        avisoFormulario(this, "Completa todos los campos");
        return;
    }
    if (!datos.montoPresupuesto || datos.montoPresupuesto <= 0) {
        avisoFormulario(this, "El monto debe ser mayor a cero");
        return;
    }

    guardandoPresupuesto = true;
    if (e.submitter) e.submitter.disabled = true;
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
        avisoFormulario(this, error.message);
    } finally {
        guardandoPresupuesto = false;
        if (e.submitter) e.submitter.disabled = false;
    }
});

async function renderizarTabla() {
    peticionPresupuestos?.abort();
    peticionPresupuestos = new AbortController();
    const { signal } = peticionPresupuestos;
    estadoListado("Cargando presupuestos…", "carga");
    let presupuestos;
    try {
        presupuestos = await apiFetch("/presupuestos", { signal });
    } catch (error) {
        if (!signal.aborted) estadoListado(error.message, "error");
        return;
    }
    if (signal.aborted) return;
    estadoListado("");

    let tabla = document.getElementById("tablaPresupuestos");
    tabla.innerHTML = "";

    if (presupuestos.length === 0) {
        let fila = document.createElement("tr");
        let celda = document.createElement("td");
        celda.className = "cs-card cs-budget-empty";
        celda.textContent = "Aún no tienes presupuestos registrados.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }

    const hoy = fechaLocalISO();
    presupuestos.forEach(p => tabla.appendChild(tarjetaPresupuesto(p, hoy)));
}

function tarjetaPresupuesto(p, hoy) {
    const fila = document.createElement("tr");
    const celda = document.createElement("td");
    const tarjeta = document.getElementById("plantillaPresupuesto").content.cloneNode(true);
    const campo = nombre => tarjeta.querySelector(`[data-presupuesto="${nombre}"]`);
    const esMeta = p.tipo === "Ingreso";
    const fechaVisible = fecha => fecha.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
    const estado = p.estado !== "Activo" ? p.estado
        : p.fechaInicio > hoy ? "Futuro" : p.fechaFin < hoy ? "Finalizado" : "Vigente";
    const [alerta, tono] = p.excedido ? ["Límite superado", "error"]
        : p.metaAlcanzada ? ["Meta alcanzada", "exito"]
        : p.limiteAlcanzado ? ["Límite alcanzado", "aviso"]
        : p.alertaPreventiva ? ["Alerta preventiva", "aviso"] : ["", ""];
    const valores = {
        nombre: p.nombrePresupuesto,
        categoria: p.categoria,
        tipo: esMeta ? "Meta de ingresos" : "Límite de egresos",
        estado,
        periodo: `${fechaVisible(p.fechaInicio)} a ${fechaVisible(p.fechaFin)}`,
        monto: formatoCOP(p.montoPresupuesto),
        ejecutado: formatoCOP(p.ejecutado),
        "saldo-label": esMeta ? "Diferencia frente a la meta" : "Disponible",
        saldo: formatoCOP(p.disponible),
        porcentaje: p.porcentaje + "%",
        alerta
    };
    for (const [nombre, valor] of Object.entries(valores)) campo(nombre).textContent = valor;
    campo("estado").dataset.estado = estado;
    campo("alerta").hidden = !alerta;
    tarjeta.querySelector("article").dataset.tono = tono;
    tarjeta.querySelector("article").dataset.tipo = esMeta ? "ingreso" : "egreso";
    fila.classList.toggle("fila-excedida", Boolean(p.excedido));
    const barra = tarjeta.querySelector(".barra-progreso");
    barra.style.width = Math.max(0, Math.min(p.porcentaje, 100)) + "%";
    barra.classList.toggle("excedido", Boolean(p.excedido));
    tarjeta.querySelector("footer").append(botonesOperacion(() => editarPresupuesto(p), () => eliminarPresupuestoUI(p.idPresupuesto), true));
    celda.appendChild(tarjeta);
    fila.appendChild(celda);
    return fila;
}

function editarPresupuesto(p) {
    avisoFormulario(formularioPresupuesto);
    editandoId = p.idPresupuesto;
    document.getElementById("nombrePresupuesto").value = p.nombrePresupuesto;
    seleccionarCatalogoHistorico(document.getElementById("categoria"), p.idCategoria, p.categoria);
    document.getElementById("montoPresupuesto").value = p.montoPresupuesto;
    document.getElementById("fechaInicio").value = p.fechaInicio;
    document.getElementById("fechaFin").value = p.fechaFin;
    document.getElementById("estadoPresupuesto").value = p.estado;

    document.getElementById("btnGuardarPresupuesto").textContent = "Actualizar";
    document.getElementById("btnCancelarPresupuesto").style.display = "inline-block";
    enfocarEdicion(tituloFormulario, "Editar presupuesto");
}

function cancelarEdicion() {
    editandoId = null;
    avisoFormulario(formularioPresupuesto);
    tituloFormulario.textContent = "Nuevo presupuesto";
    document.getElementById("presupuestoForm").reset();
    document.querySelectorAll("#presupuestoForm [data-historico]").forEach(opcion => opcion.remove());
    document.getElementById("fechaInicio").value = primerDiaDelMes();
    document.getElementById("fechaFin").value = ultimoDiaDelMes();
    document.getElementById("btnGuardarPresupuesto").textContent = "Guardar";
    document.getElementById("btnCancelarPresupuesto").style.display = "none";
}

async function eliminarPresupuestoUI(id) {
    const confirmado = await confirmarEliminacion("¿Seguro que deseas eliminar este presupuesto?");
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
