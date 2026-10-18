document.getElementById("registroForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    let nombre = document.getElementById("nombre").value.trim();
    let apellido = document.getElementById("apellido").value.trim();
    let cedula = document.getElementById("cedula").value.trim();
    let correo = document.getElementById("correo").value.trim();
    let rol = document.getElementById("rol").value;
    let password = document.getElementById("password").value;
    let confirmPassword = document.getElementById("confirmPassword").value;

    if (!nombre || !apellido || !cedula || !correo || !rol || !password || !confirmPassword) {
        mostrarNotificacion("Todos los campos son obligatorios", "error");
        return;
    }
    if (password.length < 6) {
        mostrarNotificacion("La contraseña debe tener al menos 6 caracteres", "error");
        return;
    }
    if (password !== confirmPassword) {
        mostrarNotificacion("Las contraseñas no coinciden", "error");
        return;
    }

    try {
        await apiFetch("/auth/registro", {
            method: "POST",
            body: JSON.stringify({ documento: cedula, nombre, apellido, correo, password, rol })
        });

        mostrarNotificacion("Registro exitoso", "ok");
        setTimeout(() => { window.location.href = "index.html"; }, 1500);

    } catch (error) {
        mostrarNotificacion(error.message, "error");
    }
});