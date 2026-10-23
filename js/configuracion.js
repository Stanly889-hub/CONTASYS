let sesionUsuario = exigirSesion();

async function iniciar() {
    if (!sesionUsuario) return;

    if (sesionUsuario.rol !== "Administrador") {
        mostrarNotificacion("No tienes permisos para ver esta página", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
        return;
    }

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="configuracion"]').classList.add("active");

    await renderizarCategorias();
    await renderizarMetodos();
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
    let categorias;
    try {
        categorias = await apiFetch("/categorias/todas");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    let tabla = document.getElementById("tablaCategorias");
    tabla.innerHTML = "";

    categorias.forEach(c => {
        let fila = document.createElement("tr");
        [c.codigoCategoria, c.nombreCategoria, c.tipo, c.estado].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });

        let celdaAcciones = document.createElement("td");
        let boton = document.createElement("button");
        boton.textContent = c.estado === "Activa" ? "Desactivar" : "Activar";
        boton.className = "btn-accion " + (c.estado === "Activa" ? "btn-eliminar" : "btn-editar");
        boton.onclick = async () => {
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
    let metodos;
    try {
        metodos = await apiFetch("/metodos-pago/todos");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    let tabla = document.getElementById("tablaMetodos");
    tabla.innerHTML = "";

    metodos.forEach(m => {
        let fila = document.createElement("tr");
        [m.nombreMetodo, m.descripcion || "—", m.estado].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });

        let celdaAcciones = document.createElement("td");
        let boton = document.createElement("button");
        boton.textContent = m.estado === "Activo" ? "Desactivar" : "Activar";
        boton.className = "btn-accion " + (m.estado === "Activo" ? "btn-eliminar" : "btn-editar");
        boton.onclick = async () => {
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