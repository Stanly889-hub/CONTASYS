let sesionUsuario = exigirSesion();

async function iniciar() {
    if (!sesionUsuario) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="cuenta"]').classList.add("active");

    document.getElementById("datosNombre").textContent = `${sesionUsuario.nombre} ${sesionUsuario.apellido || ""}`;
    document.getElementById("datosCorreo").textContent = sesionUsuario.correo;
    document.getElementById("datosRol").textContent = sesionUsuario.rol;

    await cargarSuscripcion();
    await cargarActividad();
}

async function cargarSuscripcion() {
    try {
        let s = await apiFetch("/suscripcion");
        document.getElementById("planActual").textContent = s.tipoPlan === "Free" ? "Free (gratuito)" : "Premium (de pago)";
        document.getElementById("planVigencia").textContent = `Vigente del ${s.fechaInicio} al ${s.fechaFin}`;

        document.getElementById("tarjetaFree").classList.toggle("plan-activo", s.tipoPlan === "Free");
        document.getElementById("tarjetaPremium").classList.toggle("plan-activo", s.tipoPlan === "Premium");

        let boton = document.getElementById("btnCambiarPlan");
        boton.textContent = s.tipoPlan === "Free" ? "Contratar Premium ($19.900 COP/mes)" : "Cancelar Premium (volver a Free)";
        boton.onclick = () => cambiarPlan(s.tipoPlan === "Free" ? "Premium" : "Free");
    } catch (error) {
        document.getElementById("planActual").textContent = "Sin suscripción";
    }
}

async function cambiarPlan(nuevoPlan) {
    let mensaje = nuevoPlan === "Premium"
        ? "El plan Premium es de pago: $19.900 COP al mes.\n\n(Pago simulado: no se realizará ningún cobro real.)\n\n¿Confirmas la contratación?"
        : "Vas a cancelar tu plan Premium y volver al plan gratuito Free. ¿Confirmas?";

    if (!confirm(mensaje)) return;

    try {
        await apiFetch("/suscripcion", { method: "PUT", body: JSON.stringify({ tipoPlan: nuevoPlan }) });
        mostrarNotificacion(nuevoPlan === "Premium" ? "Premium contratado (simulado)" : "Volviste al plan Free", "ok");
        cargarSuscripcion();
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
}

async function cargarActividad() {
    let actividad;
    try {
        actividad = await apiFetch("/historial");
    } catch (error) {
        return;
    }

    let tabla = document.getElementById("tablaActividad");
    tabla.innerHTML = "";

    actividad.slice(0, 10).forEach(a => {
        let fila = document.createElement("tr");
        [a.fecha, a.accion, a.modulo].forEach(valor => {
            let td = document.createElement("td");
            td.textContent = valor;
            fila.appendChild(td);
        });
        tabla.appendChild(fila);
    });
}

iniciar();