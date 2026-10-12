// Lógica de la página de login (index.html)

let intentosFallidos = 0;

document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    let usuario = document.getElementById("usuario").value.trim();
    let password = document.getElementById("password").value;

    if (!usuario || !password) {
        mostrarNotificacion("Completa todos los campos", "error");
        return;
    }
 let passwordHash = await hashPassword(password);
    let user = login(usuario, passwordHash);

    if (user) {
         let { password, ...usuarioSinPassword } = user;
         localStorage.setItem("sesion", JSON.stringify(usuarioSinPassword));

        window.location.href = "dashboard.html";

        } else {
    intentosFallidos++;

    if (intentosFallidos >= 3) {
        window.location.href = "error.html";

    } else {
        mostrarNotificacion(
            `Credenciales inválidas (intento ${intentosFallidos} de 3)`,
            "error"
        );
    }
}
});