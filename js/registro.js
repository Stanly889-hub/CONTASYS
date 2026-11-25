document.getElementById("registroForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (this.getAttribute("aria-busy") === "true") return;

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
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        mostrarNotificacion("La contraseña debe tener al menos 8 caracteres e incluir letras y números", "error");
        return;
    }
    if (password !== confirmPassword) {
        mostrarNotificacion("Las contraseñas no coinciden", "error");
        return;
    }

    const terminarEnvio = iniciarEnvioFormulario(this);
    try {
        await apiFetch("/auth/registro", {
            method: "POST",
            body: JSON.stringify({ documento: cedula, nombre, apellido, correo, password, rol })
        });

        mostrarNotificacion("Registro exitoso", "ok");
        setTimeout(() => { window.location.href = "index.html"; }, 1500);

    } catch (error) {
        terminarEnvio();
        mostrarNotificacion(error.message, "error");
    }
});
