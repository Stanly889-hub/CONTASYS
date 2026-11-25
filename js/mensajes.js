const sesionUsuario = exigirSesion();

if (sesionUsuario) {
    const porId = id => document.getElementById(id);
    const panel = porId("chatMensajes");
    const botonAnterior = porId("mensajesAnteriores");
    const input = porId("chatInput");
    let conversacion;
    let peticionContactos;
    let ultimaCargaContactos = 0;
    let enviando = false;
    let timer;

    async function cargarContactos(forzar = false) {
        if (peticionContactos) return peticionContactos;
        if (!forzar && Date.now() - ultimaCargaContactos < 20000) return;
        peticionContactos = apiFetch("/mensajes/contactos").then(contactos => {
            ultimaCargaContactos = Date.now();
            const lista = porId("listaContactos");
            lista.replaceChildren();
            for (const c of contactos) {
                const item = document.createElement("div");
                item.className = "chat-contacto" + (conversacion?.contacto.idUsuario === c.idUsuario ? " activo" : "");
                item.textContent = `${c.nombre} ${c.apellido} (${c.rol})`;
                if (Number(c.noLeidos) > 0) {
                    const badge = document.createElement("span");
                    badge.className = "chat-badge";
                    badge.textContent = c.noLeidos;
                    item.append(badge);
                }
                item.onclick = () => abrir(c);
                lista.append(item);
            }
            if (!contactos.length) lista.textContent = "No hay otros usuarios activos.";
        }).catch(error => mostrarNotificacion(error.message, "error")).finally(() => { peticionContactos = null; });
        return peticionContactos;
    }

    function insertar(m, alInicio) {
        const burbuja = document.createElement("div");
        burbuja.className = "chat-burbuja " + (m.idEmisor === sesionUsuario.idUsuario ? "propia" : "ajena");
        const texto = document.createElement("p");
        texto.textContent = m.contenido;
        const hora = document.createElement("span");
        hora.className = "chat-hora";
        hora.textContent = m.fechaEnvio;
        burbuja.append(texto, hora);
        burbuja.dataset.orden = `${m.fechaEnvio}|${String(m.idMensaje).padStart(10, "0")}`;
        const extremo = alInicio ? panel.firstElementChild : panel.lastElementChild;
        if (!extremo || (!alInicio && extremo.dataset.orden <= burbuja.dataset.orden)) panel.append(burbuja);
        else if (alInicio && extremo.dataset.orden >= burbuja.dataset.orden) panel.prepend(burbuja);
        else {
            const sucesor = Array.from(panel.children).find(b => b.dataset.orden > burbuja.dataset.orden);
            panel.insertBefore(burbuja, sucesor || null);
        }
    }

    async function cargar(actual, modo) {
        if (!actual || actual.cargando) return;
        actual.cargando = true;
        botonAnterior.disabled = true;
        const query = new URLSearchParams({ limite: 50 });
        if (modo === "antes") query.set("antes", actual.primero);
        if (modo === "despues" && actual.ultimo) query.set("despues", actual.ultimo);
        try {
            const { registros, hayMas } = await apiFetch(`/mensajes/${actual.contacto.idUsuario}?${query}`, { signal: actual.abort.signal });
            if (actual !== conversacion || actual.abort.signal.aborted) return;
            const altura = panel.scrollHeight;
            const abajo = altura - panel.scrollTop - panel.clientHeight < 40;
            if (modo === "inicio" || (registros.length && !actual.ids.size)) panel.replaceChildren();
            if (modo !== "despues" || !actual.ids.size) botonAnterior.hidden = !hayMas;
            for (const m of modo === "antes" ? [...registros].reverse() : registros) {
                if (actual.ids.has(m.idMensaje)) continue;
                actual.ids.add(m.idMensaje);
                actual.primero = Math.min(actual.primero, m.idMensaje);
                actual.ultimo = Math.max(actual.ultimo, m.idMensaje);
                insertar(m, modo === "antes");
            }
            if (!actual.ids.size) panel.textContent = "Aún no hay mensajes. ¡Escribe el primero!";
            if (modo === "antes") panel.scrollTop += panel.scrollHeight - altura;
            else if (abajo || modo === "inicio") panel.scrollTop = panel.scrollHeight;
        } catch (error) {
            if (!actual.abort.signal.aborted) {
                if (modo === "inicio") panel.textContent = "No se pudo cargar la conversación.";
                mostrarNotificacion(error.message, "error");
            }
        } finally {
            actual.cargando = false;
            if (actual === conversacion) botonAnterior.disabled = false;
        }
    }

    async function abrir(contacto) {
        conversacion?.abort.abort();
        const actual = { contacto, abort: new AbortController(), ids: new Set(), primero: Infinity, ultimo: 0, cargando: false };
        conversacion = actual;
        panel.textContent = "Cargando conversación…";
        input.value = "";
        botonAnterior.hidden = true;
        porId("chatTitulo").textContent = `${contacto.nombre} ${contacto.apellido}`;
        porId("chatForm").style.display = "flex";
        await cargar(actual, "inicio");
        if (actual === conversacion) await cargarContactos(true);
    }

    async function actualizar() {
        if (document.hidden || timer === null) return;
        const turno = timer;
        await cargar(conversacion, "despues");
        if (!document.hidden && timer === turno) {
            await cargarContactos();
            if (!document.hidden && timer === turno) timer = setTimeout(actualizar, 5000);
        }
    }

    function pausar() { clearTimeout(timer); timer = null; }
    function continuar() {
        if (timer === null && !document.hidden) timer = setTimeout(actualizar, 5000);
    }
    timer = null;
    document.addEventListener("visibilitychange", () => document.hidden ? pausar() : continuar());
    window.addEventListener("pagehide", pausar);
    window.addEventListener("pageshow", continuar);
    botonAnterior.onclick = () => cargar(conversacion, "antes");
    porId("chatForm").addEventListener("submit", async evento => {
        evento.preventDefault();
        const actual = conversacion;
        const contenido = input.value.trim();
        if (!actual || !contenido || enviando) return;
        enviando = true;
        if (evento.submitter) evento.submitter.disabled = true;
        try {
            await apiFetch("/mensajes", { method: "POST", body: JSON.stringify({ idReceptor: actual.contacto.idUsuario, contenido }) });
            if (actual === conversacion) {
                if (input.value.trim() === contenido) input.value = "";
                await cargar(actual, "despues");
            }
        } catch (error) {
            mostrarNotificacion(error.message, "error");
        } finally {
            enviando = false;
            if (evento.submitter) evento.submitter.disabled = false;
        }
    });
    porId("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="mensajes"]').classList.add("active");
    cargarContactos();
    continuar();
}
