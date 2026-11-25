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
    const navegarFacturas = crearPaginador(campo("historialFacturas").closest("table"), cargarPaginaFacturas);
    let guardandoFactura = false;
    let corrigiendoPago = false;
    let cambiandoEstado = false;
    let peticionDetalle;

    function crearConcepto() {
        if (conceptos.childElementCount >= 99) return mostrarNotificacion("Máximo 100 conceptos", "error");
        const bloque = campo("plantillaConcepto").content.firstElementChild.cloneNode(true);
        bloque.querySelector(".quitarConcepto").onclick = () => bloque.remove();
        conceptos.append(bloque);
        return bloque;
    }

    function limpiar() {
        borrador = null;
        form.reset();
        conceptos.replaceChildren();
        campo("fechaFactura").value = fechaLocalISO();
        campo("tituloFactura").textContent = "Generar factura";
        campo("cancelarFactura").hidden = true;
        form.querySelector('[value="emitir"]').hidden = false;
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
        dialogo.close();
        form.scrollIntoView();
    }

    function gestionar(tarea) {
        return async evento => {
            evento?.preventDefault();
            const boton = evento?.submitter || (evento?.type === "click" ? evento.currentTarget : null);
            if (boton) boton.disabled = true;
            try {
                await tarea(evento);
            } catch (error) {
                mostrarNotificacion(error.message, "error");
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
        const { facturas, resumen, siguiente } = await apiFetch(ruta, { signal });
        if (signal.aborted) return;
        for (const campoImporte of ["facturado", "pagado", "pendiente"]) {
            campo(campoImporte).textContent = formatoCOPExacto(resumen[campoImporte]);
        }
        campo("cantidadFacturas").textContent = resumen.cantidad;
        const tabla = campo("historialFacturas");
        tabla.replaceChildren();
        if (!facturas.length) {
            const celda = tabla.insertRow().insertCell();
            celda.colSpan = 6;
            celda.textContent = "No hay facturas que coincidan.";
        }
        for (const f of facturas) {
            const fila = tabla.insertRow();
            for (const texto of [f.numero, f.fecha ?? "—", f.receptorNombre ?? "—", f.estado, formatoCOPExacto(f.total)]) {
                fila.insertCell().textContent = texto;
            }
            fila.cells[3].className = `factura-estado estado-${f.estado.toLowerCase()}`;
            agregarAccion(fila.insertCell(), "Ver detalle", () => mostrarDetalle(f.idFactura));
        }
        return siguiente;
    }

    function agregarAccion(contenedor, texto, tarea) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn-accion btn-editar";
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
        agregarTexto(`Fecha: ${factura.fecha ?? "Sin fecha"} · Emisor: ${factura.emisorNombre} (${factura.emisorDocumento})`);
        agregarTexto(`Cliente: ${factura.receptorNombre ?? "Sin nombre"}${factura.receptorDocumento ? " · " + factura.receptorDocumento : ""}`);
        const lista = document.createElement("ul");
        for (const item of factura.detalle) {
            const li = document.createElement("li");
            li.textContent = `${item.concepto} · ${item.cantidad} × ${formatoCOPExacto(item.precioUnitario)} · Descuento ${formatoCOPExacto(item.descuento)} · Impuesto ${formatoCOPExacto(item.impuesto)} · ${formatoCOPExacto(item.total)}`;
            lista.append(li);
        }
        detalle.append(lista);
        agregarTexto(`Subtotal ${formatoCOPExacto(factura.subtotal)} · Descuentos ${formatoCOPExacto(factura.descuento)} · Impuestos ${formatoCOPExacto(factura.impuesto)} · Total ${formatoCOPExacto(factura.total)}`);
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
            agregarAccion(acciones, "Anular", () => confirm(`¿Anular ${factura.numero}?`) && actualizarEstado("Anulada"));
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
        guardandoFactura = true;
        try {
            const emitir = !borrador && evento.submitter?.value === "emitir";
            const detalle = [form, ...conceptos.children].map(bloque => Object.fromEntries(
                Object.entries(selectores).map(([clave, selector]) => [clave, bloque.querySelector(selector).value])
            ));
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
    formularioPago.addEventListener("submit", gestionar(() => {
        if (campo("modoPagoFactura").value === "existente") {
            const idIngreso = campo("ingresoExistente").value;
            if (!idIngreso || !confirm(`¿Asociar el ingreso #${idIngreso} a ${facturaVisible.numero}? Se conservarán los datos del ingreso y no se creará otro.`)) return;
            return actualizarEstado("Pagada", { idIngreso, confirmarConciliacion: true });
        }
        return actualizarEstado("Pagada", { idCategoria: campo("categoriaPago").value, idMetodoPago: campo("metodoPagoFactura").value });
    }));
    campo("modoPagoFactura").addEventListener("change", gestionar(mostrarModoPago));
    formularioCorreccion.addEventListener("submit", gestionar(async () => {
        if (corrigiendoPago || cambiandoEstado) return;
        const motivo = campo("motivoCorreccion").value.trim();
        if (!motivo) return mostrarNotificacion("Indica el motivo de la corrección", "error");
        if (!confirm(`¿Confirmas la corrección interna de ${facturaVisible.numero}? ${campo("consecuenciaCorreccion").textContent}\nEsta operación no realiza una devolución de dinero.`)) return;
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
    campo("agregarConcepto").onclick = crearConcepto;
    campo("cancelarFactura").onclick = limpiar;
    campo("filtrosFacturas").addEventListener("submit", gestionar(cargarHistorial));
    campo("nombreUsuarioActual").textContent = `${sesionUsuario.nombre} (${sesionUsuario.rol})`;
    aplicarPermisosPorRol(sesionUsuario.rol);
    campo("seccionFactura").hidden = delegada;
    document.querySelector('[data-page="facturacion"]').classList.add("active");
    limpiar();
    gestionar(cargarHistorial)();
}
