const { centavos, decimal } = require("./finanzas");
const { DatoFinancieroInvalido, montoValido, textoValido, fechaValida } = require("./validacionFinanciera");

const ESTADOS = ["Borrador", "Pendiente", "Pagada", "Anulada"];
const MAXIMO = 999999999999n;
const formatos = { cantidad: /^\d{1,6}(?:\.\d{1,3})?$/, porcentaje: /^\d{1,3}(?:\.\d{1,2})?$/ };
const redondear = (importe, divisor) => (importe * 2n + divisor) / (divisor * 2n);

function escala(valor, formato, decimales) {
    const texto = ["string", "number"].includes(typeof valor) ? String(valor) : "";
    if (texto !== texto.trim() || !formatos[formato].test(texto)) throw new DatoFinancieroInvalido(`${formato} inválido`);
    const [entero, fraccion = ""] = texto.split(".");
    return BigInt(entero + fraccion.padEnd(decimales, "0"));
}

function calcularFactura(body, borrador = false) {
    const nombre = typeof body.receptorNombre === "string" ? body.receptorNombre.trim() : body.receptorNombre;
    const receptorNombre = textoValido(nombre, "El nombre del receptor", 150, borrador);
    const receptorDocumento = textoValido(body.receptorDocumento, "El documento del receptor", 50, true);
    const fecha = borrador && (body.fecha === "" || body.fecha == null) ? null : fechaValida(body.fecha);
    const lineas = body.detalle ?? (borrador ? [] : null);
    if (!Array.isArray(lineas) || (!borrador && lineas.length < 1) || lineas.length > 100) {
        throw new DatoFinancieroInvalido("Incluye entre 1 y 100 conceptos");
    }
    const suma = { subtotal: 0n, descuento: 0n, impuesto: 0n, total: 0n };
    const borradorDetalle = [];
    const detalle = lineas.flatMap((linea, i) => {
        if (!linea || typeof linea !== "object") throw new DatoFinancieroInvalido("Concepto inválido");
        const texto = typeof linea.concepto === "string" ? linea.concepto.trim() : linea.concepto;
        const concepto = textoValido(texto, "El concepto", 250, borrador);
        const vacio = valor => valor === "" || valor == null;
        const cantidad = borrador && vacio(linea.cantidad) ? null : escala(linea.cantidad, "cantidad", 3);
        const precio = borrador && (vacio(linea.precioUnitario) || /^(0|0\.0{1,2})$/.test(String(linea.precioUnitario)))
            ? null : montoValido(linea.precioUnitario);
        const descuentoPct = escala(vacio(linea.porcentajeDescuento) ? "0" : linea.porcentajeDescuento, "porcentaje", 2);
        const impuestoPct = escala(vacio(linea.porcentajeImpuesto) ? "0" : linea.porcentajeImpuesto, "porcentaje", 2);
        if (cantidad === 0n || descuentoPct > 10000n || impuestoPct > 10000n) {
            throw new DatoFinancieroInvalido("La cantidad debe ser positiva y los porcentajes deben estar entre 0 y 100");
        }
        const datos = { concepto: concepto ?? "", cantidad: cantidad === null ? "" : String(linea.cantidad),
            precioUnitario: precio ?? (vacio(linea.precioUnitario) ? "" : "0"),
            porcentajeDescuento: decimal(descuentoPct), porcentajeImpuesto: decimal(impuestoPct) };
        if (borrador) borradorDetalle.push(datos);
        if (!concepto || cantidad === null || precio === null) return [];
        const subtotal = redondear(cantidad * centavos(precio), 1000n);
        const descuento = redondear(subtotal * descuentoPct, 10000n);
        const impuesto = redondear((subtotal - descuento) * impuestoPct, 10000n);
        const importes = { subtotal, descuento, impuesto, total: subtotal - descuento + impuesto };
        for (const [campo, valor] of Object.entries(importes)) suma[campo] += valor;
        return [{ renglon: i + 1, ...datos, ...serializar(importes) }];
    });
    if (Object.values(suma).some(valor => valor > MAXIMO)) {
        throw new DatoFinancieroInvalido("La factura excede el importe máximo de $9.999.999.999,99");
    }
    if (!borrador && suma.total <= 0n) throw new DatoFinancieroInvalido("La factura debe tener un total positivo para emitirse");
    return { receptorNombre, receptorDocumento, fecha, detalle, borradorDetalle, ...serializar(suma) };
}

function serializar(importes) {
    return Object.fromEntries(Object.entries(importes).map(([campo, valor]) => [campo, decimal(valor)]));
}

function numeroFactura(consecutivo) {
    return `FAC-${String(consecutivo).padStart(8, "0")}`;
}

module.exports = { ESTADOS, calcularFactura, numeroFactura };
