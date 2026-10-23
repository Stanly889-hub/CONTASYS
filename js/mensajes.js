let sesionUsuario = exigirSesion();
let contactoActual = null;
let temporizador = null;

async function iniciar() {
    if (!sesionUsuario) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="mensajes"]').classList.add("active");

    await cargarContactos();

    // Actualiza automaticamente cada 5 segundos para simular chat en tiempo real.
    temporizador = setInterval(async () => {
        await cargarContactos();
        if (contactoActual) await cargarConversacion(false);
    }, 5000);
}

async function cargarContactos() {
    let contactos;
    try {
        contactos = await apiFetch("/mensajes/contactos");
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    let lista = document.getElementById("listaContactos");
    lista.innerHTML = "";

    if (contactos.length === 0) {
        lista.innerHTML = "<p class='sin-notificaciones'>No hay otros usuarios todavía.</p>";
        return;
    }

    contactos.forEach(c => {
        let item = document.createElement("div");
        item.className = "chat-contacto" + (contactoActual && contactoActual.idUsuario === c.idUsuario ? " activo" : "");

        let nombre = document.createElement("span");
        nombre.textContent = `${c.nombre} ${c.apellido} (${c.rol})`;
        item.appendChild(nombre);

        if (Number(c.noLeidos) > 0) {
            let badge = document.createElement("span");
            badge.className = "chat-badge";
            badge.textContent = c.noLeidos;
            item.appendChild(badge);
        }

        item.onclick = () => abrirConversacion(c);
        lista.appendChild(item);
    });
}

async function abrirConversacion(contacto) {
    contactoActual = contacto;
    document.getElementById("chatTitulo").textContent = `${contacto.nombre} ${contacto.apellido}`;
    document.getElementById("chatForm").style.display = "flex";
    await cargarConversacion(true);
    await cargarContactos();
}

async function cargarConversacion(desplazarAlFinal) {
    let mensajes;
    try {
        mensajes = await apiFetch(`/mensajes/${contactoActual.idUsuario}`);
    } catch (error) {
        mostrarNotificacion(error.message, "error");
        return;
    }

    let panel = document.getElementById("chatMensajes");
    let estabaAbajo = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 40;
    panel.innerHTML = "";

    if (mensajes.length === 0) {
        panel.innerHTML = "<p class='sin-notificaciones'>Aún no hay mensajes. ¡Escribe el primero!</p>";
        return;
    }

    mensajes.forEach(m => {
        let burbuja = document.createElement("div");
        burbuja.className = "chat-burbuja " + (m.idEmisor === sesionUsuario.idUsuario ? "propia" : "ajena");

        let texto = document.createElement("p");
        texto.textContent = m.contenido;

        let hora = document.createElement("span");
        hora.className = "chat-hora";
        hora.textContent = m.fechaEnvio;

        burbuja.append(texto, hora);
        panel.appendChild(burbuja);
    });

    if (desplazarAlFinal || estabaAbajo) panel.scrollTop = panel.scrollHeight;
}

document.getElementById("chatForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    let input = document.getElementById("chatInput");
    let contenido = input.value.trim();
    if (!contenido || !contactoActual) return;

    try {
        await apiFetch("/mensajes", {
            method: "POST",
            body: JSON.stringify({ idReceptor: contactoActual.idUsuario, contenido })
        });
        input.value = "";
        await cargarConversacion(true);
    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
});

iniciar();