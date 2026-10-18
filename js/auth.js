// Ya no se genera hash en el navegador: el backend lo hace con bcrypt (Sección 6).

function obtenerSesion() {
    return JSON.parse(localStorage.getItem("sesion"));
}

function exigirSesion() {
    let sesion = obtenerSesion();
    if (!sesion || !sesion.token) {
        window.location.href = "index.html";
        return null;
    }
    return sesion.usuario;
}

function cerrarSesion() {
    localStorage.removeItem("sesion");
    window.location.href = "index.html";
}

function aplicarPermisosPorRol(rolActual) {
    document.querySelectorAll("[data-rol]").forEach(el => {
        if (el.getAttribute("data-rol") !== rolActual) {
            el.style.display = "none";
        }
    });
}