document.querySelectorAll(".cs-password-toggle").forEach(boton => {
    const campo = document.getElementById(boton.getAttribute("aria-controls"));
    const icono = boton.querySelector("use");

    boton.addEventListener("click", () => {
        const mostrar = campo.type === "password";
        campo.type = mostrar ? "text" : "password";
        boton.setAttribute("aria-label", `${mostrar ? "Ocultar" : "Mostrar"} ${boton.dataset.passwordLabel}`);
        icono.setAttribute("href", mostrar ? "css/iconos.svg#ojo-cerrado" : "css/iconos.svg#ojo");
    });
});
