let sesionUsuario = exigirSesion();

async function iniciar() {
    if (!sesionUsuario) return;

    if (sesionUsuario.rol !== "Administrador") {
        mostrarNotificacion("No tienes permisos para ver esta página", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
        return;
    }

    iniciarMarcoOperacion(sesionUsuario, "configuracion");
    document.getElementById("contenidoConfiguracion").hidden = false;

    await Promise.all([renderizarCategorias(), renderizarMetodos()]);
}

document.getElementById("categoriaForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    let datos = {
        nombreCategoria: document.getElementById("nombreCategoria").value.trim(),
        tipo: document.getElementById("tipoCategoria").value,
        descripcion: document.getElementById("descripcionCategoria").value.trim()
    };

    try {
        await apiFetch("/categorias", { method: "POST", body: JSON.stringify(datos) });
        mostrarNotificacion("Categoría creada", "ok");
        this.reset();
        renderizarCategorias();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
});

async function renderizarCategorias() {
    estadoAdministracion("estadoCategorías", "Cargando categorías…");
    let categorias;
    try {
        categorias = await apiFetch("/categorias/todas");
    } catch (error) {
        estadoAdministracion("estadoCategorías", error.message, true);
        mostrarNotificacion(error.message, "error");
        return;
    }
    estadoAdministracion("estadoCategorías", "");

    let tabla = document.getElementById("tablaCategorias");
    tabla.innerHTML = "";
    if (!categorias.length) vacioAdministracion(tabla, 5, "No hay categorías registradas.");

    categorias.forEach(c => {
        let fila = document.createElement("tr");
        [c.codigoCategoria, c.nombreCategoria].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });
        fila.insertCell().append(etiquetaAdministracion(c.tipo));
        fila.insertCell().append(etiquetaAdministracion(c.estado));

        let celdaAcciones = document.createElement("td");
        let boton = document.createElement("button");
        boton.textContent = c.estado === "Activa" ? "Desactivar" : "Activar";
        boton.insertAdjacentHTML("afterbegin", iconoOperacion(c.estado === "Activa" ? "desactivar" : "activar"));
        boton.type = "button";
        boton.className = "btn-accion cs-button cs-button-secondary " + (c.estado === "Activa" ? "btn-eliminar" : "btn-editar");
        boton.onclick = async () => {
            if (!await confirmarEliminacion(`¿${boton.textContent} la categoría ${c.nombreCategoria}?`)) return;
            try {
                await apiFetch(`/categorias/${c.idCategoria}/estado`, {
                    method: "PUT",
                    body: JSON.stringify({ estado: c.estado === "Activa" ? "Inactiva" : "Activa" })
                });
                renderizarCategorias();
            } catch (error) {
                mostrarNotificacion(error.message, "error");
            }
        };
        celdaAcciones.appendChild(boton);
        fila.appendChild(celdaAcciones);

        tabla.appendChild(fila);
    });
}

document.getElementById("metodoForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    let datos = {
        nombreMetodo: document.getElementById("nombreMetodo").value.trim(),
        descripcion: document.getElementById("descripcionMetodo").value.trim()
    };

    try {
        await apiFetch("/metodos-pago", { method: "POST", body: JSON.stringify(datos) });
        mostrarNotificacion("Método de pago creado", "ok");
        this.reset();
        renderizarMetodos();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
});

async function renderizarMetodos() {
    estadoAdministracion("estadoMétodos", "Cargando métodos de pago…");
    let metodos;
    try {
        metodos = await apiFetch("/metodos-pago/todos");
    } catch (error) {
        estadoAdministracion("estadoMétodos", error.message, true);
        mostrarNotificacion(error.message, "error");
        return;
    }
    estadoAdministracion("estadoMétodos", "");

    let tabla = document.getElementById("tablaMetodos");
    tabla.innerHTML = "";
    if (!metodos.length) vacioAdministracion(tabla, 4, "No hay métodos de pago registrados.");

    metodos.forEach(m => {
        let fila = document.createElement("tr");
        [m.nombreMetodo, m.descripcion || "—"].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });
        fila.insertCell().append(etiquetaAdministracion(m.estado));

        let celdaAcciones = document.createElement("td");
        let boton = document.createElement("button");
        boton.textContent = m.estado === "Activo" ? "Desactivar" : "Activar";
        boton.insertAdjacentHTML("afterbegin", iconoOperacion(m.estado === "Activo" ? "desactivar" : "activar"));
        boton.type = "button";
        boton.className = "btn-accion cs-button cs-button-secondary " + (m.estado === "Activo" ? "btn-eliminar" : "btn-editar");
        boton.onclick = async () => {
            if (!await confirmarEliminacion(`¿${boton.textContent} el método ${m.nombreMetodo}?`)) return;
            try {
                await apiFetch(`/metodos-pago/${m.idMetodoPago}/estado`, {
                    method: "PUT",
                    body: JSON.stringify({ estado: m.estado === "Activo" ? "Inactivo" : "Activo" })
                });
                renderizarMetodos();
            } catch (error) {
                mostrarNotificacion(error.message, "error");
            }
        };
        celdaAcciones.appendChild(boton);
        fila.appendChild(celdaAcciones);

        tabla.appendChild(fila);
    });
}

iniciar();
