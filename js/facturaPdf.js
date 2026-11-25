function descargarFacturaPDF(factura) {
    const doc = new window.jspdf.jsPDF();
    let y = 18;
    function escribir(texto) {
        for (const linea of doc.splitTextToSize(texto, 180)) {
            if (y > 280) {
                doc.addPage();
                y = 18;
            }
            doc.text(linea, 14, y);
            y += 6;
        }
    }
    doc.setFontSize(15);
    escribir(`CONTASYS - ${factura.numero}`);
    doc.setFontSize(10);
    escribir("Documento comercial interno o de demostración");
    escribir(`Fecha: ${factura.fecha} | Estado: ${factura.estado}`);
    escribir(`Emisor: ${factura.emisorNombre} | Documento: ${factura.emisorDocumento} | Correo: ${factura.emisorCorreo}`);
    escribir(`Receptor: ${factura.receptorNombre}${factura.receptorDocumento ? " | Documento: " + factura.receptorDocumento : ""}`);
    for (const item of factura.detalle) {
        escribir(`${item.concepto} | Cantidad: ${item.cantidad} | Valor unitario: ${formatoCOPExacto(item.precioUnitario)}`);
        escribir(`Descuento: ${formatoCOPExacto(item.descuento)} (${item.porcentajeDescuento} %) | Impuesto: ${formatoCOPExacto(item.impuesto)} (${item.porcentajeImpuesto} %) | Total: ${formatoCOPExacto(item.total)}`);
    }
    escribir(`Subtotal: ${formatoCOPExacto(factura.subtotal)} | Descuentos: ${formatoCOPExacto(factura.descuento)} | Impuestos: ${formatoCOPExacto(factura.impuesto)}`);
    escribir(`Total: ${formatoCOPExacto(factura.total)}`);
    doc.save(`${factura.numero}.pdf`);
}
