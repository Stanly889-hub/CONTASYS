// Vista previa local. El servidor conserva la validación y el cálculo definitivo.
function calcularImportesVisiblesFactura(lineas) {
    const suma = { Subtotal: 0n, Descuento: 0n, Impuesto: 0n, Total: 0n };
    const redondear = (importe, divisor) => (importe * 2n + divisor) / (divisor * 2n);
    for (const linea of lineas) {
        const { concepto, cantidad, precioUnitario, porcentajeDescuento, porcentajeImpuesto } = linea;
        const descuentoTexto = porcentajeDescuento || "0";
        const impuestoTexto = porcentajeImpuesto || "0";
        const patronPorcentaje = /^\d{1,3}(?:\.\d{1,2})?$/;
        if (!concepto.trim() || [...concepto.trim()].length > 250 ||
            !/^\d{1,6}(?:\.\d{1,3})?$/.test(cantidad) ||
            !/^\d{1,10}(?:\.\d{1,2})?$/.test(precioUnitario) ||
            !patronPorcentaje.test(descuentoTexto) || !patronPorcentaje.test(impuestoTexto)) return null;

        const [entero, fraccion = ""] = cantidad.split(".");
        const unidades = BigInt(entero + fraccion.padEnd(3, "0"));
        const precio = centavosCOP(precioUnitario);
        const descuentoPct = centavosCOP(descuentoTexto);
        const impuestoPct = centavosCOP(impuestoTexto);
        if (!unidades || !precio || descuentoPct > 10000n || impuestoPct > 10000n) return null;

        // Redondeo por concepto, en el orden subtotal, descuento e impuesto.
        const subtotal = redondear(unidades * precio, 1000n);
        const descuento = redondear(subtotal * descuentoPct, 10000n);
        const impuesto = redondear((subtotal - descuento) * impuestoPct, 10000n);
        suma.Subtotal += subtotal;
        suma.Descuento += descuento;
        suma.Impuesto += impuesto;
        suma.Total += subtotal - descuento + impuesto;
    }
    return suma;
}

const sesionUsuario = exigirSesion();

if (sesionUsuario) {
    const campo = id => document.getElementById(id);
    const form = campo("facturaForm");
    const dialogo = campo("dialogoFactura");
    const formularioPago = campo("pagoFactura");
    const formularioCorreccion = campo("correccionFactura");
    const conceptos = campo("conceptosFactura");
    const delegada = Boolean(obtenerClienteActivo());
    const selectores = { concepto: ".concepto", precioUnitario: ".precio", cantidad: ".cantidad",
        porcentajeDescuento: ".descuento", porcentajeImpuesto: ".impuesto" };
    let borrador = null;
    let facturaVisible = null;
    const navegarFacturas = crearPaginador(campo("historialFacturas").closest(".factura-tabla"), cargarPaginaFacturas);
    let guardandoFactura = false;
    let corrigiendoPago = false;
    let cambiandoEstado = false;
    let peticionDetalle;

    function mostrarEstado(texto, error = false) {
        const estado = campo("estadoListado");
        estado.textContent = texto;
        estado.hidden = !texto;
        estado.classList.toggle("cs-module-loading", Boolean(texto) && !error);
        estado.classList.toggle("cs-status-error", error);
    }

    function confirmarFactura(texto) {
        const confirmacion = campo("confirmacionOperacion");
        campo("textoConfirmacion").textContent = texto;
        confirmacion.returnValue = "";
        return new Promise(resolver => {
            confirmacion.addEventListener("close", () => resolver(confirmacion.returnValue === "confirmar"), { once: true });
            confirmacion.showModal();
        });
    }

    function crearConcepto() {
        if (conceptos.childElementCount >= 99) return mostrarNotificacion("Máximo 100 conceptos", "error");
        const bloque = campo("plantillaConcepto").content.firstElementChild.cloneNode(true);
        bloque.querySelector(".quitarConcepto").onclick = () => {
            bloque.remove();
            actualizarImportes();
        };
        conceptos.append(bloque);
        return bloque;
    }

    function leerConceptos() {
        return [form, ...conceptos.children].map(bloque => Object.fromEntries(
            Object.entries(selectores).map(([clave, selector]) => [clave, bloque.querySelector(selector).value])
        ));
    }

    function actualizarImportes() {
        const suma = calcularImportesVisiblesFactura(leerConceptos());
        const excedeLimite = suma && Object.values(suma).some(valor => valor > 999999999999n);
        const nota = !suma ? "Completa todos los conceptos con valores válidos para calcular los importes."
            : excedeLimite ? "Los importes superan el máximo permitido para una factura."
            : suma.Total === 0n ? "El total debe ser positivo para emitir la factura." : "";
        for (const nombre of ["Subtotal", "Descuento", "Impuesto", "Total"]) {
            const valor = suma?.[nombre];
            campo(`factura${nombre}`).textContent = suma && !excedeLimite
                ? formatoCOPExacto(`${valor / 100n}.${String(valor % 100n).padStart(2, "0")}`)
                : "—";
        }
        const estado = campo("notaImportesFactura");
        if (estado.textContent !== nota) estado.textContent = nota;
        estado.hidden = !nota;
    }

    function limpiar() {
        borrador = null;
        form.reset();
        conceptos.replaceChildren();
        campo("fechaFactura").value = fechaLocalISO();
        campo("tituloFactura").textContent = "Generar factura";
        campo("cancelarFactura").hidden = true;
        form.querySelector('[value="emitir"]').hidden = false;
        errorFormulario("");
        actualizarImportes();
    }

    function errorFormulario(mensaje) {
        const aviso = campo("errorFormularioFactura");
        aviso.textContent = mensaje;
        aviso.hidden = !mensaje;
    }

    function cargarBorrador(factura) {
        limpiar();
        borrador = factura.idFactura;
        campo("tituloFactura").textContent = `Editar ${factura.numero}`;
        campo("nombreCliente").value = factura.receptorNombre ?? "";
        campo("documentoCliente").value = factura.receptorDocumento ?? "";
        campo("fechaFactura").value = factura.fecha ?? "";
        (factura.borradorDetalle ?? factura.detalle).forEach((linea, i) => {
            const bloque = i ? crearConcepto() : form;
            for (const [clave, selector] of Object.entries(selectores)) bloque.querySelector(selector).value = linea[clave];
        });
        campo("cancelarFactura").hidden = false;
        form.querySelector('[value="emitir"]').hidden = true;
        actualizarImportes();
        dialogo.close();
        form.scrollIntoView();
    }

    function gestionar(tarea) {
        return async evento => {
            evento?.preventDefault();
            const esFormularioFactura = evento?.currentTarget === form;
            const boton = evento?.submitter || (evento?.type === "click" ? evento.currentTarget : null);
            if (boton) boton.disabled = true;
            try {
                await tarea(evento);
            } catch (error) {
                if (esFormularioFactura) {
                    errorFormulario(error.status === 500
                        ? "No se pudo guardar la factura. Pide al administrador que compruebe las migraciones de facturación."
                        : error.message);
                } else {
                    mostrarNotificacion(error.message, "error");
                }
            } finally {
                if (boton) boton.disabled = false;
            }
        };
    }

    async function cargarHistorial() {
        const filtros = new URLSearchParams();
        for (const [nombre, valor] of new FormData(campo("filtrosFacturas"))) {
            if (valor.trim()) filtros.set(nombre, valor.trim());
        }
        return navegarFacturas(filtros.size ? `/facturas?${filtros}` : "/facturas");
    }

    async function cargarPaginaFacturas(ruta, signal) {
        mostrarEstado("Cargando facturas…");
        let datos;
        try {
            datos = await apiFetch(ruta, { signal });
        } catch (error) {
            if (!signal.aborted) mostrarEstado(error.message, true);
            throw error;
        }
        if (signal.aborted) return;
        const { facturas, resumen, siguiente } = datos;
        for (const campoImporte of ["facturado", "pagado", "pendiente"]) {
            campo(campoImporte).textContent = formatoCOPExacto(resumen[campoImporte]);
        }
        campo("cantidadFacturas").textContent = resumen.cantidad;
        campo("resumenFacturas").hidden = false;
        mostrarEstado("");
        const tabla = campo("historialFacturas");
        tabla.replaceChildren();
        if (!facturas.length) {
            const celda = tabla.insertRow().insertCell();
            celda.colSpan = 6;
            celda.className = "cs-table-empty";
            celda.textContent = "No hay facturas que coincidan.";
        }
        for (const f of facturas) {
            const fila = tabla.insertRow();
            for (const texto of [f.numero, f.fecha ?? "—", f.receptorNombre ?? "—", f.estado, formatoCOPExacto(f.total)]) {
                fila.insertCell().textContent = texto;
            }
            fila.cells[3].className = `factura-estado estado-${f.estado.toLowerCase()}`;
            const etiqueta = document.createElement("span");
            etiqueta.className = "fac-status";
            const simbolos = { Borrador: "✎", Pendiente: "◷", Pagada: "✓", Anulada: "×" };
            const icono = document.createElement("span");
            icono.setAttribute("aria-hidden", "true");
            icono.textContent = simbolos[f.estado] ?? "";
            etiqueta.append(icono, f.estado);
            fila.cells[3].replaceChildren(etiqueta);
            agregarAccion(fila.insertCell(), "Ver detalle", () => mostrarDetalle(f.idFactura));
        }
        return siguiente;
    }

    function agregarAccion(contenedor, texto, tarea) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn-accion btn-editar cs-button cs-button-secondary";
        boton.textContent = texto;
        boton.onclick = gestionar(tarea);
        contenedor.append(boton);
    }

    async function prepararPago() {
        const [categorias, metodos] = await Promise.all([apiFetch("/categorias?tipo=ingreso"), apiFetch("/metodos-pago")]);
        campo("categoriaPago").replaceChildren(new Option("Selecciona categoría", ""),
            ...categorias.map(c => new Option(c.nombreCategoria, c.idCategoria)));
        campo("metodoPagoFactura").replaceChildren(new Option("Selecciona método de pago", ""),
            ...metodos.map(m => new Option(m.nombreMetodo, m.idMetodoPago)));
        campo("modoPagoFactura").value = "nuevo";
        await mostrarModoPago();
        formularioPago.hidden = false;
        campo("modoPagoFactura").focus();
    }

    async function mostrarModoPago() {
        const existente = campo("modoPagoFactura").value === "existente";
        campo("catalogosPagoFactura").hidden = existente;
        campo("categoriaPago").disabled = existente;
        campo("metodoPagoFactura").disabled = existente;
        campo("selectorIngresoExistente").hidden = !existente;
        const selector = campo("ingresoExistente");
        selector.disabled = !existente;
        if (!existente) return;
        selector.replaceChildren(new Option("Buscando ingresos elegibles…", ""));
        const ingresos = await apiFetch(`/facturas/${facturaVisible.idFactura}/ingresos-elegibles`);
        selector.replaceChildren(new Option(ingresos.length ? "Selecciona un ingreso" : "No hay ingresos elegibles", ""),
            ...ingresos.map(i => new Option(`#${i.idIngreso} · ${i.fecha} · ${formatoCOPExacto(i.monto)} · ${i.descripcion || i.categoria}`, i.idIngreso)));
    }

    function renderizarDetalle(factura) {
        facturaVisible = factura;
        formularioPago.hidden = true;
        formularioCorreccion.hidden = true;
        formularioCorreccion.reset();
        campo("detalleTitulo").textContent = `${factura.numero} · ${factura.estado}`;
        const detalle = campo("detalleFactura");
        detalle.replaceChildren();
        const agregarTexto = texto => {
            const p = document.createElement("p");
            p.textContent = texto;
            detalle.append(p);
        };
        const partes = document.createElement("dl");
        partes.className = "fac-preview-partes";
        function par(contenedor, titulo, texto) {
            const bloque = document.createElement("div");
            const etiqueta = document.createElement("dt");
            const valor = document.createElement("dd");
            etiqueta.textContent = titulo;
            valor.textContent = texto;
            bloque.append(etiqueta, valor);
            contenedor.append(bloque);
        }
        par(partes, "Emisor", `${factura.emisorNombre} · ${factura.emisorDocumento} · ${factura.emisorCorreo}`);
        par(partes, "Cliente", `${factura.receptorNombre ?? "Sin nombre"}${factura.receptorDocumento ? " · " + factura.receptorDocumento : ""}`);
        par(partes, "Fecha", factura.fecha ?? "Sin fecha");
        detalle.append(partes);
        const lista = document.createElement("div");
        lista.className = "factura-tabla fac-preview-table";
        lista.setAttribute("role", "region");
        lista.setAttribute("aria-label", "Conceptos de la factura");
        lista.tabIndex = 0;
        const tabla = document.createElement("table");
        const cabecera = tabla.createTHead().insertRow();
        for (const texto of ["Concepto", "Cantidad", "Unitario", "Descuento", "Impuesto", "Total"]) {
            const th = document.createElement("th");
            th.scope = "col";
            th.textContent = texto;
            cabecera.append(th);
        }
        const cuerpo = tabla.createTBody();
        for (const item of factura.detalle) {
            const fila = cuerpo.insertRow();
            for (const valor of [item.concepto, item.cantidad, ...[item.precioUnitario, item.descuento, item.impuesto, item.total].map(formatoCOPExacto)]) {
                fila.insertCell().textContent = valor;
            }
        }
        lista.append(tabla);
        detalle.append(lista);
        const totales = document.createElement("dl");
        totales.className = "fac-preview-totals";
        for (const [label, valor] of [["Subtotal", factura.subtotal], ["Descuentos", factura.descuento], ["Impuestos", factura.impuesto], ["Total", factura.total]]) {
            par(totales, label, formatoCOPExacto(valor));
        }
        detalle.append(totales);
        if (factura.fechaPago) agregarTexto(`Pago registrado el ${factura.fechaPago} · Ingreso #${factura.idIngreso}`);
        if (!delegada && factura.historialPagos?.length) {
            agregarTexto("Historial de pagos");
            for (const pago of factura.historialPagos) {
                const origen = pago.origen === "Facturacion" ? "Ingreso creado desde la factura" : "Ingreso conciliado";
                agregarTexto(`Pago #${pago.idPago} · ${pago.fechaPago} · ${formatoCOPExacto(pago.monto)} · Ingreso #${pago.idIngreso} · ${origen}`);
                if (pago.corregidoEn) agregarTexto(`Corregido el ${pago.corregidoEn} · Motivo: ${pago.motivoCorreccion}`);
            }
        }
        const acciones = campo("accionesFactura");
        acciones.replaceChildren();
        if (factura.fechaEmision || (factura.estado === "Borrador" && factura.receptorNombre && factura.fecha && factura.detalle.length)) {
            agregarAccion(acciones, "Descargar PDF", async () => descargarFacturaPDF(await apiFetch(`/facturas/${factura.idFactura}`)));
        }
        if (delegada) return;
        if (factura.estado === "Pagada") {
            const pago = factura.historialPagos?.find(p => p.idIngreso === factura.idIngreso && !p.corregidoEn);
            if (pago) agregarAccion(acciones, "Corregir pago", () => prepararCorreccion(pago));
            else agregarTexto("Pago histórico sin origen verificable. La corrección automática no está disponible.");
        }
        if (factura.estado === "Borrador") {
            agregarAccion(acciones, "Editar", () => cargarBorrador(factura));
            agregarAccion(acciones, "Emitir", () => actualizarEstado("Pendiente"));
        }
        if (factura.estado === "Pendiente") agregarAccion(acciones, "Registrar pago", prepararPago);
        if (["Borrador", "Pendiente"].includes(factura.estado)) {
            agregarAccion(acciones, "Anular", async () => {
                if (await confirmarFactura(`¿Anular ${factura.numero}?`)) await actualizarEstado("Anulada");
            });
        }
    }

    function prepararCorreccion(pago) {
        formularioCorreccion.dataset.idPago = pago.idPago;
        campo("consecuenciaCorreccion").textContent = pago.origen === "Facturacion"
            ? "El ingreso creado desde la factura quedará anulado y se descontará del balance confirmado. La factura volverá a Pendiente."
            : "El ingreso confirmado quedará disponible para conciliarse con otra factura. El balance se conservará y esta factura volverá a Pendiente.";
        formularioCorreccion.hidden = false;
        campo("motivoCorreccion").focus();
    }

    async function mostrarDetalle(id) {
        peticionDetalle?.abort();
        const peticion = new AbortController();
        peticionDetalle = peticion;
        let factura;
        try {
            factura = await apiFetch(`/facturas/${id}`, { signal: peticion.signal });
        } catch (error) {
            if (peticion.signal.aborted) return;
            throw error;
        }
        if (peticion.signal.aborted) return;
        renderizarDetalle(factura);
        if (!dialogo.open) dialogo.showModal();
    }

    async function actualizarEstado(estado, datos = {}) {
        if (cambiandoEstado || corrigiendoPago) return;
        cambiandoEstado = true;
        const id = facturaVisible.idFactura;
        try {
            const factura = await apiFetch(`/facturas/${id}/estado`, {
                method: "PUT", body: JSON.stringify({ estado, ...datos })
            });
            if (facturaVisible.idFactura === id) renderizarDetalle(factura);
            mostrarNotificacion("Estado de factura actualizado", "ok");
            await cargarHistorial();
        } finally {
            cambiandoEstado = false;
        }
    }

    form.addEventListener("submit", gestionar(async evento => {
        if (guardandoFactura) return;
        errorFormulario("");
        guardandoFactura = true;
        try {
            const emitir = !borrador && evento.submitter?.value === "emitir";
            const detalle = leerConceptos();
            const factura = await apiFetch(borrador ? `/facturas/${borrador}` : "/facturas", {
                method: borrador ? "PUT" : "POST",
                body: JSON.stringify({ emitir, detalle, receptorNombre: campo("nombreCliente").value,
                    receptorDocumento: campo("documentoCliente").value.trim(), fecha: campo("fechaFactura").value })
            });
            limpiar();
            mostrarNotificacion(emitir ? "Factura emitida" : "Borrador guardado", "ok");
            if (emitir) descargarFacturaPDF(factura);
            await cargarHistorial();
        } finally {
            guardandoFactura = false;
        }
    }));
    formularioPago.addEventListener("submit", gestionar(async () => {
        if (campo("modoPagoFactura").value === "existente") {
            const idIngreso = campo("ingresoExistente").value;
            if (!idIngreso || !await confirmarFactura(`¿Asociar el ingreso #${idIngreso} a ${facturaVisible.numero}? Se conservarán los datos del ingreso y no se creará otro.`)) return;
            return actualizarEstado("Pagada", { idIngreso, confirmarConciliacion: true });
        }
        return actualizarEstado("Pagada", { idCategoria: campo("categoriaPago").value, idMetodoPago: campo("metodoPagoFactura").value });
    }));
    campo("modoPagoFactura").addEventListener("change", gestionar(mostrarModoPago));
    formularioCorreccion.addEventListener("submit", gestionar(async () => {
        if (corrigiendoPago || cambiandoEstado) return;
        const motivo = campo("motivoCorreccion").value.trim();
        if (!motivo) return mostrarNotificacion("Indica el motivo de la corrección", "error");
        if (!await confirmarFactura(`¿Confirmas la corrección interna de ${facturaVisible.numero}? ${campo("consecuenciaCorreccion").textContent}\nEsta operación no realiza una devolución de dinero.`)) return;
        corrigiendoPago = true;
        const id = facturaVisible.idFactura;
        try {
            const factura = await apiFetch(`/facturas/${id}/correcciones-pago`, {
                method: "POST", body: JSON.stringify({ idPago: formularioCorreccion.dataset.idPago, motivo, confirmar: true })
            });
            if (facturaVisible.idFactura === id) renderizarDetalle(factura);
            mostrarNotificacion("Pago corregido. La factura está pendiente.", "ok");
            await cargarHistorial();
        } finally {
            corrigiendoPago = false;
        }
    }));
    campo("agregarConcepto").onclick = () => {
        crearConcepto();
        actualizarImportes();
    };
    form.addEventListener("input", evento => {
        errorFormulario("");
        if (evento.target.closest(".fac-group-items")) actualizarImportes();
    });
    form.addEventListener("invalid", evento => {
        const campoInvalido = evento.target;
        const etiqueta = campoInvalido.labels?.[0]?.textContent.trim();
        errorFormulario(etiqueta ? `${etiqueta}: ${campoInvalido.validationMessage}` : campoInvalido.validationMessage);
    }, true);
    campo("cancelarFactura").onclick = limpiar;
    campo("filtrosFacturas").addEventListener("submit", gestionar(cargarHistorial));
    if (typeof iniciarMarcoOperacion === "function") iniciarMarcoOperacion(sesionUsuario, "facturacion");
    else {
        campo("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
        aplicarPermisosPorRol(sesionUsuario.rol);
        document.querySelector('[data-page="facturacion"]').classList.add("active");
    }
    campo("seccionFactura").hidden = delegada;
    limpiar();
    gestionar(cargarHistorial)();
}
