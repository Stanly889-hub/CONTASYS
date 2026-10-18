function formatoCOP(monto) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(monto);
}

function mostrarNotificacion(mensaje, tipo) {
    let div = document.createElement("div");
    div.className = "notificacion " + tipo;
    div.textContent = mensaje;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}