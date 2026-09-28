// Lógica de la página de registro (registro.html)

document.getElementById("registroForm").addEventListener("submit", function (e) {
    e.preventDefault();

    let usuario = {
        nombre: document.getElementById("nombre").value.trim(),
        apellido: document.getElementById("apellido").value.trim(),
        cedula: document.getElementById("cedula").value.trim(),
        fecha: document.getElementById("fecha").value,
        rol: document.getElementById("rol").value,
        password: document.getElementById("password").value
    };

    let confirmPassword = document.getElementById("confirmPassword").value;

    if (Object.values(usuario).includes("") || !confirmPassword) {
        mostrarNotificacion("Todos los campos son obligatorios", "error");
        return;
    }

    if (usuario.password !== confirmPassword) {
        mostrarNotificacion("Las contraseñas no coinciden", "error");
        return;
    }

    let guardado = registrarUsuario(usuario);

    if (guardado) {
        mostrarNotificacion("Registro exitoso", "ok");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1500);
    }
});