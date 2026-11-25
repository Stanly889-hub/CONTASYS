function avatarComunicacion(nombre, apellido) {
    const avatar = document.createElement("span");
    avatar.className = "com-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = [nombre, apellido].filter(Boolean).map(parte => Array.from(parte.trim())[0] || "")
        .join("").toLocaleUpperCase("es") || "•";
    return avatar;
}

function fechaComunicacion(valor) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(valor);
    if (!partes) return valor;
    const [, anio, mes, dia, hora] = partes;
    return `${dia}/${mes}/${anio}${hora ? ` · ${hora}` : ""}`;
}
