let sesionUsuario = exigirSesion();

function iniciar() {
    if (!sesionUsuario) return;

    document.getElementById("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    document.querySelector('[data-page="facturacion"]').classList.add("active");

    document.getElementById("fechaFactura").value = new Date().toISOString().slice(0, 10);
}

document.getElementById("facturaForm").addEventListener("submit", function (e) {
    e.preventDefault();

    let cliente = document.getElementById("nombreCliente").value.trim();
    let documento = document.getElementById("documentoCliente").value.trim();
    let concepto = document.getElementById("conceptoFactura").value.trim();
    let valor = Number(document.getElementById("valorFactura").value);
    let fecha = document.getElementById("fechaFactura").value;

    if (!cliente || !concepto || !valor || valor <= 0 || !fecha) {
        mostrarNotificacion("Completa todos los campos obligatorios", "error");
        return;
    }

    const numeroFactura = "FAC-" + Date.now().toString().slice(-8);

    const { jsPDF } = window.jspdf;
    let doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("CONTASYS", 14, 20);
    doc.setFontSize(11);
    doc.text(`Factura N° ${numeroFactura}`, 14, 28);
    doc.text(`Fecha: ${fecha}`, 14, 34);

    doc.line(14, 40, 196, 40);

    doc.setFontSize(12);
    doc.text("Cliente:", 14, 50);
    doc.setFontSize(11);
    doc.text(cliente, 14, 57);
    if (documento) doc.text(`Documento: ${documento}`, 14, 64);

    doc.setFontSize(12);
    doc.text("Concepto:", 14, 78);
    doc.setFontSize(11);
    doc.text(concepto, 14, 85);

    doc.line(14, 95, 196, 95);

    doc.setFontSize(14);
    doc.text(`Total: ${formatoCOP(valor)}`, 14, 105);

    doc.setFontSize(9);
    doc.text(`Emitido por: ${sesionUsuario.nombre} (${sesionUsuario.rol})`, 14, 280);

    doc.save(`${numeroFactura}.pdf`);
    mostrarNotificacion("Factura generada", "ok");
    this.reset();
    document.getElementById("fechaFactura").value = new Date().toISOString().slice(0, 10);
});

iniciar();