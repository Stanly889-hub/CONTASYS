function etiquetaAdministracion(texto, variante = texto) {
    const etiqueta = document.createElement("span");
    etiqueta.className = "cs-pill adm-etiqueta";
    etiqueta.dataset.variante = variante;
    etiqueta.textContent = texto;
    return etiqueta;
}

function personaAdministracion(persona) {
    const perfil = document.createElement("div");
    perfil.className = "adm-persona";
    const nombre = document.createElement("strong");
    nombre.textContent = [persona.nombre, persona.apellido].filter(Boolean).join(" ");
    perfil.append(avatarComunicacion(persona.nombre, persona.apellido), nombre);
    return perfil;
}

function vacioAdministracion(tabla, columnas, texto) {
    const celda = tabla.insertRow().insertCell();
    celda.colSpan = columnas;
    celda.className = "cs-table-empty";
    celda.textContent = texto;
}

function estadoAdministracion(id, texto, error = false) {
    const estado = document.getElementById(id);
    estado.hidden = !texto;
    estado.textContent = texto;
    estado.classList.toggle("cs-module-loading", Boolean(texto) && !error);
    estado.classList.toggle("cs-status-error", error);
}
