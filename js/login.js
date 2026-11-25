let intentosFallidos = 0;

document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (this.getAttribute("aria-busy") === "true") return;

    let correo = document.getElementById("correo").value.trim();
    let password = document.getElementById("password").value;

    if (!correo || !password) {
        mostrarNotificacion("Completa todos los campos", "error");
        return;
    }

    const terminarEnvio = iniciarEnvioFormulario(this);
    try {
        let datos = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ correo, password })
        });

        localStorage.setItem("sesion", JSON.stringify(datos));
        window.location.href = "dashboard.html";

    } catch (error) {
        terminarEnvio();
        // El servidor bloqueó temporalmente por demasiados intentos: mostrar su mensaje.
        if (error.status === 429) {
            mostrarNotificacion(error.message, "error");
            return;
        }

        intentosFallidos++;
        if (intentosFallidos >= 3) {
            window.location.href = "error.html";
        } else {
            mostrarNotificacion(`${error.message} (intento ${intentosFallidos} de 3)`, "error");
        }
    }
});
