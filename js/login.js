// Lógica de la página de login (index.html)

document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();

    let usuario = document.getElementById("usuario").value;
    let password = document.getElementById("password").value;

    let user = login(usuario, password);

    if (user) {
        localStorage.setItem("sesion", JSON.stringify(user));
        window.location.href = "dashboard.html";
    } else {
        mostrarNotificacion("Información inválida", "error");
    }
});