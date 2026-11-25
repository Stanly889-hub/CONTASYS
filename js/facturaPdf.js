function crearDocumentoFactura(factura) {
    const doc = new window.jspdf.jsPDF();
    const marino = "#0F172A";
    const azul = "#2563EB";
    const suave = "#DBEAFE";
    const gris = "#475569";
    const margen = 14;
    const limite = 275;
    const ancho = 182;
    const columnas = [
        ["Concepto", 52], ["Cantidad", 18], ["Unitario COP", 29],
        ["Descuento", 27], ["Impuesto", 27], ["Total COP", 29]
    ];
    let pagina = 1;
    let y;

    function estilo(tamano, color = marino, negrita = false) {
        doc.setFontSize(tamano);
        doc.setTextColor?.(color);
        doc.setFont?.("helvetica", negrita ? "bold" : "normal");
    }
    function fondo(color, x, arriba, w, h) {
        doc.setFillColor?.(color);
        doc.rect?.(x, arriba, w, h, "F");
    }
    function pie() {
        fondo(suave, margen, 281, ancho, .35);
        estilo(8, gris);
        doc.text("CONTASYS · Documento comercial interno", margen, 287);
        doc.text(String(pagina), margen + ancho, 287, { align: "right" });
    }
    function cabecera(primera) {
        fondo(marino, 0, 0, 210, 34);
        const marcaDisponible = typeof agregarMarcaPDF === "function";
        if (marcaDisponible) agregarMarcaPDF(doc, margen, 5, 24);
        estilo(15, "#FFFFFF", true);
        doc.text(marcaDisponible ? "Factura" : "CONTASYS", 69, 16);
        estilo(9, "#DBEAFE");
        doc.text("Documento comercial interno o de demostración", 69, 23);
        y = 43;
        parrafo(factura.numero, 16, marino, true);
        if (primera) parrafo(`Fecha: ${factura.fecha} · Estado: ${factura.estado}`, 10, gris);
        y += 3;
    }
    function nuevaPagina() {
        pie();
        doc.addPage();
        pagina++;
        cabecera(false);
    }
    function parrafo(texto, tamano = 10, color = marino, negrita = false, x = margen, w = ancho) {
        estilo(tamano, color, negrita);
        const paso = tamano >= 14 ? 7 : 5;
        for (const linea of doc.splitTextToSize(texto, w)) {
            doc.text(linea, x, y);
            y += paso;
        }
    }
    function cabeceraTabla() {
        fondo(suave, margen, y, ancho, 8);
        let x = margen;
        estilo(8, marino, true);
        for (const [etiqueta, espacio] of columnas) {
            doc.text(etiqueta, x + 2, y + 5);
            x += espacio;
        }
        y += 8;
    }

    cabecera(true);
    parrafo("EMISOR", 9, azul, true);
    parrafo(`Emisor: ${factura.emisorNombre} · Documento: ${factura.emisorDocumento} · Correo: ${factura.emisorCorreo}`);
    y += 2;
    parrafo("CLIENTE", 9, azul, true);
    parrafo(`Receptor: ${factura.receptorNombre}${factura.receptorDocumento ? " · Documento: " + factura.receptorDocumento : ""}`);
    y += 4;
    cabeceraTabla();

    for (const [indice, item] of factura.detalle.entries()) {
        const valores = [
            item.concepto, String(item.cantidad), formatoCOPExacto(item.precioUnitario),
            `${formatoCOPExacto(item.descuento)}\n${item.porcentajeDescuento} %`,
            `${formatoCOPExacto(item.impuesto)}\n${item.porcentajeImpuesto} %`,
            formatoCOPExacto(item.total)
        ];
        estilo(8.5);
        const celdas = valores.map((valor, i) => String(valor).split("\n")
            .flatMap(linea => doc.splitTextToSize(linea, columnas[i][1] - 4)));
        const lineas = Math.max(...celdas.map(celda => celda.length));
        const capacidad = () => Math.floor((limite - y - 5) / 4.3);
        if (lineas > capacidad()) {
            nuevaPagina();
            cabeceraTabla();
        }
        for (let inicio = 0; inicio < lineas;) {
            const cantidad = Math.min(lineas - inicio, capacidad());
            const altura = cantidad * 4.3 + 5;
            if (indice % 2 === 0) fondo("#F8FAFC", margen, y, ancho, altura);
            estilo(8.5);
            let x = margen;
            for (const [i, celda] of celdas.entries()) {
                const w = columnas[i][1];
                for (const [j, linea] of celda.slice(inicio, inicio + cantidad).entries()) {
                    doc.text(linea, i === 0 ? x + 2 : x + w - 2, y + 4.5 + j * 4.3, { align: i === 0 ? "left" : "right" });
                }
                x += w;
            }
            y += altura;
            inicio += cantidad;
            if (inicio < lineas) {
                nuevaPagina();
                cabeceraTabla();
            }
        }
    }

    if (y + 36 > limite) nuevaPagina();
    y += 6;
    const xTotal = 115;
    fondo("#F8FAFC", xTotal - 4, y - 4, 85, 30);
    for (const [etiqueta, monto] of [["Subtotal", factura.subtotal], ["Descuentos", factura.descuento], ["Impuestos", factura.impuesto]]) {
        parrafo(`${etiqueta}: ${formatoCOPExacto(monto)}`, 9, gris, false, xTotal, 77);
    }
    y += 3;
    parrafo(`Total: ${formatoCOPExacto(factura.total)}`, 12, azul, true, xTotal, 77);
    pie();
    return doc;
}

function descargarFacturaPDF(factura) {
    crearDocumentoFactura(factura).save(`${factura.numero}.pdf`);
}
