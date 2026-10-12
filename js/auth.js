// ===== HASH DE CONTRASEÑAS =====

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ===== CONTROL DE SESION =====
function obtenerSesion() {
    return JSON.parse(localStorage.getItem("sesion"));
}

function exigirSesion() {
    let sesion = obtenerSesion();
    if (!sesion) {
        window.location.href = "index.html";
    }
    return sesion;
}

function cerrarSesion() {
    localStorage.removeItem("sesion");
    window.location.href = "index.html";
}

// ===== PERMISOS POR ROL =====
// Oculta cualquier elemento marcado con data-rol="X" si el usuario
// que inicio sesion no tiene ese rol.
function aplicarPermisosPorRol(rolActual) {
    document.querySelectorAll("[data-rol]").forEach(el => {
        if (el.getAttribute("data-rol") !== rolActual) {
            el.style.display = "none";
        }
    });
}