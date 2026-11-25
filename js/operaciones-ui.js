function iconoOperacion(nombre) {
    return `<svg class="ui-icon" aria-hidden="true"><use href="css/iconos.svg#${nombre}"></use></svg>`;
}

function iniciarMarcoOperacion(usuario, pagina) {
    const grupos = [
        ["Vista general", [["dashboard", "panel", "Dashboard"], ["analisis", "grafica", "Análisis financiero"], ["reportes", "reporte", "Reportes"]]],
        ["Operaciones", [["ingresos", "entrada", "Ingresos", "movimientos.html?tipo=ingreso"], ["egresos", "salida", "Egresos", "movimientos.html?tipo=egreso"], ["presupuestos", "billetera", "Presupuestos"], ["facturacion", "factura", "Facturación"]]],
        ["Mi espacio", [["mensajes", "chat", "Chat"], ["notificaciones", "campana", "Notificaciones"], ["cuenta", "persona", "Mi cuenta"]]],
        ["Gestión", [["clientes", "grupo", "Clientes", null, "Contador"], ["usuarios", "grupo", "Usuarios", null, "Administrador"], ["configuracion", "ajustes", "Configuración", null, "Administrador"]]]
    ];
    const menu = document.getElementById("menuFinanciero");
    const marca = `<picture class="cs-brand">
        <source media="(max-width: 540px)" type="image/webp" srcset="css/marca/simbolo.webp">
        <source media="(max-width: 540px)" srcset="css/marca/simbolo.png">
        <source type="image/webp" srcset="css/marca/contasys.webp">
        <img class="cs-brand-image" src="css/marca/contasys.png" alt="CONTASYS" width="84" height="44">
    </picture>`;
    menu.innerHTML = `<h2>${marca}</h2>
        <nav aria-label="Navegación principal">${grupos.map(([titulo, enlaces]) => `
            <div class="cs-nav-group"${enlaces.some(enlace => !enlace[4] || enlace[4] === usuario.rol) ? "" : " hidden"}>
                <p>${titulo}</p>
                <ul>${enlaces.map(([clave, icono, etiqueta, href, rol]) => `
                    <li data-page="${clave}"${rol ? ` data-rol="${rol}"` : ""}${clave === pagina ? ' class="active"' : ""}>
                        <a href="${href || `${clave}.html`}"${clave === pagina ? ' aria-current="page"' : ""}>${iconoOperacion(icono)} <span>${etiqueta}</span></a>
                    </li>`).join("")}</ul>
            </div>`).join("")}</nav>`;

    const barra = document.querySelector(".topbar");
    barra.innerHTML = `
        <button class="cs-button cs-button-secondary cs-menu-toggle" type="button" aria-controls="menuFinanciero" aria-expanded="false">${iconoOperacion("menu")} Menú</button>
        <p class="cs-location">${iconoOperacion("panel")} <strong>Operaciones</strong></p>
        <div class="user">
            <a class="cs-top-notifications" data-notificaciones-acceso href="notificaciones.html" aria-label="Notificaciones">${iconoOperacion("campana")}</a>
            <a class="cs-profile" href="cuenta.html">
                <span class="cs-avatar" aria-hidden="true">${iconoOperacion("persona")}</span>
                <span><strong id="nombreUsuarioActual"></strong><small id="rolUsuarioActual"></small></span>
            </a>
            <button type="button" class="btn-logout cs-button cs-button-secondary">${iconoOperacion("logout")} <span>Cerrar sesión</span></button>
        </div>`;
    document.getElementById("nombreUsuarioActual").textContent = usuario.nombre;
    document.getElementById("rolUsuarioActual").textContent = usuario.rol;
    barra.querySelector(".btn-logout").addEventListener("click", cerrarSesion);
    aplicarPermisosPorRol(usuario.rol);

    const boton = barra.querySelector(".cs-menu-toggle");
    function mostrarMenu(abierto) {
        document.body.toggleAttribute("data-menu-abierto", abierto);
        boton.setAttribute("aria-expanded", String(abierto));
    }
    boton.addEventListener("click", evento => {
        const abierto = boton.getAttribute("aria-expanded") !== "true";
        mostrarMenu(abierto);
        if (abierto && evento.detail === 0) menu.querySelector("a").focus();
    });
    matchMedia("(max-width: 900px)").addEventListener("change", () => mostrarMenu(false));
    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape" && boton.getAttribute("aria-expanded") === "true") {
            mostrarMenu(false);
            boton.focus();
        }
    });
}

function estadoListado(texto, tipo = "") {
    const estado = document.getElementById("estadoListado");
    estado.hidden = !texto;
    estado.classList.toggle("cs-status-error", tipo === "error");
    estado.classList.toggle("cs-module-loading", tipo === "carga");
    estado.textContent = texto;
}

function avisoFormulario(formulario, mensaje = "") {
    const aviso = formulario.querySelector(".cs-form-feedback");
    aviso.hidden = !mensaje;
    aviso.textContent = mensaje;
}

function enfocarEdicion(titulo, texto) {
    titulo.textContent = texto;
    titulo.focus({ preventScroll: true });
    titulo.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}

function botonesOperacion(editar, eliminar, conIconos = false) {
    const grupo = document.createElement("div");
    grupo.className = "cs-module-actions cs-row-actions";
    for (const [texto, clase, accion] of [["Editar", "editar", editar], ["Eliminar", "eliminar", eliminar]]) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = `btn-accion btn-${clase} cs-button cs-button-secondary`;
        boton.textContent = texto;
        if (conIconos) boton.insertAdjacentHTML("afterbegin", iconoOperacion(clase));
        boton.addEventListener("click", accion);
        grupo.append(boton);
    }
    return grupo;
}

function confirmarEliminacion(texto) {
    const dialogo = document.getElementById("confirmacionOperacion");
    document.getElementById("textoConfirmacion").textContent = texto;
    dialogo.returnValue = "";
    return new Promise(aceptar => {
        dialogo.addEventListener("close", () => aceptar(dialogo.returnValue === "eliminar"), { once: true });
        dialogo.showModal();
    });
}
