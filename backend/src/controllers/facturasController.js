const pool = require("../config/db");
const { enTransaccion } = require("../utils/transaccion");
const { registrarActividad } = require("../utils/actividad");
const { bloquearPresupuestos, reevaluarMovimientos } = require("../utils/alertasPresupuesto");
const { CONFIRMADA, centavos, decimal } = require("../utils/finanzas");
const { DatoFinancieroInvalido, validarRango, idValido, textoValido, estadoValido, responderError } = require("../utils/validacionFinanciera");
const { ESTADOS, calcularFactura, numeroFactura } = require("../utils/facturas");
const { paginacion, respuestaPagina } = require("../utils/paginacion");

const conNumero = factura => ({ ...factura, numero: numeroFactura(factura.consecutivo) });
const filtrosIngreso = `i.idUsuario = ? AND i.estadoTransaccion = 'Confirmada' AND i.monto = ?
    AND i.fecha BETWEEN ? AND CURDATE()
    AND NOT EXISTS (SELECT 1 FROM Factura f WHERE f.idIngreso = i.idIngreso)`;

async function listar(req, res) {
    try {
        const { desde, hasta, estado, buscar } = req.query;
        const pagina = paginacion(req.query);
        validarRango(desde, hasta, false);
        estadoValido(estado, ESTADOS);
        const consulta = textoValido(buscar, "La búsqueda", 150, true);
        const filtros = ["idUsuario = ?"];
        if (req.contador) filtros.push("fechaEmision IS NOT NULL");
        const p = [req.usuario.idUsuario];
        if (desde) { filtros.push("fecha >= ?"); p.push(desde); }
        if (hasta) { filtros.push("fecha <= ?"); p.push(hasta); }
        if (estado) { filtros.push("estado = ?"); p.push(estado); }
        if (consulta) {
            filtros.push(`(LOCATE(?, receptorNombre) > 0 OR LOCATE(?, receptorDocumento) > 0
                OR LOCATE(?, CONCAT('FAC-', LPAD(consecutivo, GREATEST(8, CHAR_LENGTH(consecutivo)), '0'))) > 0)`);
            p.push(consulta, consulta, consulta);
        }
        const filtroBase = filtros.join(" AND ");
        const parametrosBase = [...p];
        if (pagina?.fecha) {
            // NULL se ordena después de las fechas, incluidos los borradores incompletos.
            if (pagina.fecha === "1000-01-01 00:00:00") {
                filtros.push("fecha IS NULL AND idFactura < ?");
                p.push(pagina.id);
            } else {
                filtros.push("(fecha < ? OR (fecha = ? AND idFactura < ?) OR fecha IS NULL)");
                p.push(pagina.fecha, pagina.fecha, pagina.id);
            }
        }
        if (pagina) p.push(pagina.limite + 1);
        const [[filas], [[resumen]]] = await Promise.all([pool.execute(
            `SELECT idFactura, consecutivo, fecha, estado, receptorNombre, receptorDocumento, total
             FROM Factura WHERE ${filtros.join(" AND ")} ORDER BY fecha DESC, idFactura DESC${pagina ? " LIMIT ?" : ""}`, p
        ), pool.execute(`SELECT COUNT(*) AS cantidad,
                COALESCE(SUM(CASE WHEN estado = 'Pagada' THEN total END), 0.00) AS pagado,
                COALESCE(SUM(CASE WHEN estado = 'Pendiente' THEN total END), 0.00) AS pendiente
             FROM Factura WHERE ${filtroBase}`, parametrosBase)]);
        const resultado = pagina ? respuestaPagina(filas.map(f => ({ ...f, cursorFecha: f.fecha ?? "1000-01-01 00:00:00" })),
            pagina, "cursorFecha", "idFactura") : { registros: filas };
        return res.json({ facturas: resultado.registros.map(({ cursorFecha, ...factura }) => conNumero(factura)),
            ...(pagina ? { siguiente: resultado.siguiente } : {}),
            resumen: { ...resumen, facturado: decimal(centavos(resumen.pagado) + centavos(resumen.pendiente)) } });
    } catch (error) {
        return responderError(res, error, "No se pudo consultar el historial de facturas");
    }
}

async function cargarFactura(conexion, usuario, id, bloquear = false) {
    const [[factura]] = await conexion.execute(
        `SELECT * FROM Factura WHERE idFactura = ? AND idUsuario = ?${bloquear ? " FOR UPDATE" : ""}`, [id, usuario]
    );
    return factura;
}

async function detalle(conexion, factura, delegado = false) {
    const { borradorDatos, ...cabecera } = factura;
    const [lineas] = await conexion.execute(
        "SELECT * FROM FacturaDetalle WHERE idFactura = ? AND revision = ? ORDER BY renglon",
        [factura.idFactura, factura.revision]
    );
    const borradorDetalle = factura.estado === "Borrador" && borradorDatos
        ? (typeof borradorDatos === "string" ? JSON.parse(borradorDatos) : borradorDatos) : undefined;
    const documento = { ...conNumero(cabecera), detalle: lineas, borradorDetalle };
    if (delegado) return documento;
    const [historialPagos] = await conexion.execute(
        `SELECT idPago, idIngreso, origen, fechaPago, monto, idCategoria, idMetodoPago,
                registradoEn, corregidoEn, motivoCorreccion, idActorCorreccion
         FROM PagoFactura WHERE idFactura = ? ORDER BY idPago DESC`, [factura.idFactura]
    );
    return { ...documento, historialPagos };
}

async function obtener(req, res) {
    try {
        const factura = await cargarFactura(pool, req.usuario.idUsuario, idValido(req.params.id));
        if (!factura || (req.contador && !factura.fechaEmision)) return res.status(404).json({ error: "Factura no encontrada" });
        return res.json(await detalle(pool, factura, Boolean(req.contador)));
    } catch (error) {
        return responderError(res, error, "No se pudo consultar la factura");
    }
}

async function guardar(req, res) {
    try {
        const id = req.params.id === undefined ? null : idValido(req.params.id);
        const body = req.body || {};
        const emitir = body.emitir ?? false;
        if (typeof emitir !== "boolean" || (id && emitir)) throw new DatoFinancieroInvalido("Indica una operación de emisión válida");
        const datos = calcularFactura(body, !emitir);
        const usuario = req.usuario.idUsuario;
        const factura = await enTransaccion(async conexion => {
            await bloquearPresupuestos(conexion, usuario);
            const anterior = id && await cargarFactura(conexion, usuario, id, true);
            if (id && !anterior) return null;
            if (anterior && anterior.estado !== "Borrador") return false;
            const valores = [datos.fecha, datos.receptorNombre, datos.receptorDocumento, datos.subtotal,
                datos.descuento, datos.impuesto, datos.total, emitir ? null : JSON.stringify(datos.borradorDetalle)];
            let guardado = id;
            const revision = anterior ? anterior.revision + 1 : 1;
            if (anterior) {
                await conexion.execute(
                    `UPDATE Factura SET fecha = ?, receptorNombre = ?, receptorDocumento = ?, subtotal = ?,
                        descuento = ?, impuesto = ?, total = ?, borradorDatos = ?, revision = ? WHERE idFactura = ? AND idUsuario = ?`,
                    [...valores, revision, id, usuario]
                );
            } else {
                const [[emisor]] = await conexion.execute(
                    "SELECT CONCAT(nombre, ' ', apellido) AS nombre, documento, correo FROM Usuario WHERE idUsuario = ?", [usuario]
                );
                const [[{ ultimo }]] = await conexion.execute(
                    "SELECT COALESCE(MAX(consecutivo), 0) AS ultimo FROM Factura WHERE idUsuario = ?", [usuario]
                );
                const [creada] = await conexion.execute(
                    `INSERT INTO Factura (fecha, receptorNombre, receptorDocumento, subtotal, descuento, impuesto, total, borradorDatos,
                        idUsuario, emisorNombre, emisorDocumento, emisorCorreo, consecutivo, estado, fechaEmision)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(?, NOW(), NULL))`,
                    [...valores, usuario, emisor.nombre, emisor.documento, emisor.correo, Number(ultimo) + 1,
                        emitir ? "Pendiente" : "Borrador", emitir]
                );
                guardado = creada.insertId;
            }
            const columnas = ["renglon", "concepto", "cantidad", "precioUnitario", "porcentajeDescuento",
                "porcentajeImpuesto", "subtotal", "descuento", "impuesto", "total"];
            for (const linea of datos.detalle) {
                await conexion.execute(
                    `INSERT INTO FacturaDetalle (idFactura, revision, ${columnas.join(", ")})
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [guardado, revision, ...columnas.map(campo => linea[campo])]
                );
            }
            await registrarActividad(usuario, `Factura #${guardado}: ${emitir ? "emitida" : anterior ? "borrador actualizado" : "borrador creado"}`,
                "Facturación", req.ip, conexion);
            return detalle(conexion, await cargarFactura(conexion, usuario, guardado));
        });
        if (factura === null) return res.status(404).json({ error: "Factura no encontrada" });
        if (factura === false) return res.status(409).json({ error: "Solo se pueden editar los borradores" });
        return res.status(id ? 200 : 201).json(factura);
    } catch (error) {
        return responderError(res, error, "No se pudo guardar la factura");
    }
}

async function ingresosElegibles(req, res) {
    try {
        if (req.contador) return res.status(403).json({ error: "La conciliación es exclusiva del emisor" });
        const usuario = req.usuario.idUsuario;
        const factura = await cargarFactura(pool, usuario, idValido(req.params.id));
        if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
        if (factura.estado !== "Pendiente") return res.status(409).json({ error: "La factura debe estar pendiente" });
        const [ingresos] = await pool.execute(
            `SELECT i.idIngreso, i.fecha, i.descripcion, i.monto, c.nombreCategoria AS categoria, m.nombreMetodo AS metodoPago
             FROM Ingreso i JOIN CategoriaFinanciera c ON c.idCategoria = i.idCategoria
             JOIN MetodoPago m ON m.idMetodoPago = i.idMetodoPago
             WHERE ${filtrosIngreso} ORDER BY i.fecha DESC, i.idIngreso DESC`, [usuario, factura.total, factura.fecha]
        );
        return res.json(ingresos);
    } catch (error) {
        return responderError(res, error, "No se pudieron consultar los ingresos elegibles");
    }
}

async function conciliarIngreso(conexion, usuario, factura, idIngreso) {
    const [[ingreso]] = await conexion.execute(
        `SELECT i.idIngreso, i.fecha, i.idCategoria, i.idMetodoPago FROM Ingreso i
         WHERE ${filtrosIngreso} AND i.idIngreso = ? FOR UPDATE`,
        [usuario, factura.total, factura.fecha, idIngreso]
    );
    if (!ingreso) throw new DatoFinancieroInvalido("El ingreso debe ser propio, confirmado, libre, del mismo importe y tener una fecha válida para esta factura");
    await guardarVinculoPago(conexion, factura, ingreso, "Conciliacion");
}

async function guardarVinculoPago(conexion, factura, ingreso, origen) {
    await conexion.execute("UPDATE Factura SET estado = 'Pagada', fechaPago = ?, idIngreso = ? WHERE idFactura = ?",
        [ingreso.fecha, ingreso.idIngreso, factura.idFactura]);
    await conexion.execute(
        `INSERT INTO PagoFactura (idFactura, idIngreso, origen, fechaPago, monto, idCategoria, idMetodoPago)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [factura.idFactura, ingreso.idIngreso, origen, ingreso.fecha, factura.total, ingreso.idCategoria, ingreso.idMetodoPago]
    );
}

async function registrarPago(conexion, usuario, factura, body) {
    if (centavos(factura.total) <= 0n) throw new DatoFinancieroInvalido("Un ingreso confirmado requiere un total mayor a cero");
    const categoria = idValido(body.idCategoria, "Categoría");
    const metodo = idValido(body.idMetodoPago, "Método de pago");
    const [[cat]] = await conexion.execute("SELECT tipo, estado FROM CategoriaFinanciera WHERE idCategoria = ? LOCK IN SHARE MODE", [categoria]);
    const [[mp]] = await conexion.execute("SELECT estado FROM MetodoPago WHERE idMetodoPago = ? LOCK IN SHARE MODE", [metodo]);
    if (cat?.tipo !== "Ingreso" || cat.estado !== "Activa" || mp?.estado !== "Activo") {
        throw new DatoFinancieroInvalido("Selecciona una categoría de ingreso y un método de pago activos");
    }
    const [[{ hoy }]] = await conexion.execute("SELECT CURDATE() AS hoy");
    const [ingreso] = await conexion.execute(
        `INSERT INTO Ingreso (monto, descripcion, numeroComprobante, fecha, estadoTransaccion, idUsuario, idCategoria, idMetodoPago)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [factura.total, `Pago de ${numeroFactura(factura.consecutivo)}`, numeroFactura(factura.consecutivo),
            hoy, CONFIRMADA, usuario, categoria, metodo]
    );
    await guardarVinculoPago(conexion, factura,
        { fecha: hoy, idIngreso: ingreso.insertId, idCategoria: categoria, idMetodoPago: metodo }, "Facturacion");
    await reevaluarMovimientos(conexion, usuario, [{ idCategoria: categoria, fecha: hoy, estadoTransaccion: CONFIRMADA }]);
}

async function cambiarEstado(req, res) {
    try {
        const id = idValido(req.params.id);
        const usuario = req.usuario.idUsuario;
        const body = req.body || {};
        const destino = estadoValido(body.estado, ESTADOS);
        const ingresoExistente = body.idIngreso === undefined ? null : idValido(body.idIngreso, "Ingreso");
        if (ingresoExistente !== null && (destino !== "Pagada" || body.confirmarConciliacion !== true)) {
            throw new DatoFinancieroInvalido("Confirma expresamente la conciliación del ingreso");
        }
        const transiciones = { Borrador: ["Pendiente", "Anulada"], Pendiente: ["Pagada", "Anulada"] };
        if (!destino) throw new DatoFinancieroInvalido("Indica el estado de la factura");
        const factura = await enTransaccion(async conexion => {
            await bloquearPresupuestos(conexion, usuario);
            const actual = await cargarFactura(conexion, usuario, id, true);
            if (!actual) return null;
            if (actual.estado === "Pagada" && destino === "Pagada") {
                return !ingresoExistente || ingresoExistente === actual.idIngreso ? detalle(conexion, actual) : false;
            }
            if (!transiciones[actual.estado]?.includes(destino)) return false;
            if (destino === "Pagada") {
                if (ingresoExistente) await conciliarIngreso(conexion, usuario, actual, ingresoExistente);
                else await registrarPago(conexion, usuario, actual, body);
            } else if (destino === "Pendiente") {
                const datos = await detalle(conexion, actual);
                calcularFactura({ fecha: actual.fecha, receptorNombre: actual.receptorNombre,
                    receptorDocumento: actual.receptorDocumento, detalle: datos.borradorDetalle ?? datos.detalle });
                // Toma la identidad comercial vigente al emitir el borrador.
                await conexion.execute(
                    `UPDATE Factura f JOIN Usuario u ON u.idUsuario = f.idUsuario
                     SET f.estado = 'Pendiente', f.fechaEmision = NOW(), f.borradorDatos = NULL,
                        f.emisorNombre = CONCAT(u.nombre, ' ', u.apellido), f.emisorDocumento = u.documento,
                        f.emisorCorreo = u.correo WHERE f.idFactura = ? AND f.idUsuario = ?`,
                    [id, usuario]
                );
            } else {
                await conexion.execute("UPDATE Factura SET estado = 'Anulada' WHERE idFactura = ? AND idUsuario = ?", [id, usuario]);
            }
            await registrarActividad(usuario, ingresoExistente
                ? `Factura ${numeroFactura(actual.consecutivo)}: conciliación con ingreso #${ingresoExistente}`
                : `Factura ${numeroFactura(actual.consecutivo)}: ${actual.estado} → ${destino}`,
                "Facturación", req.ip, conexion);
            return detalle(conexion, await cargarFactura(conexion, usuario, id));
        });
        if (factura === null) return res.status(404).json({ error: "Factura no encontrada" });
        if (factura === false) return res.status(409).json({ error: "No se permite ese cambio de estado" });
        return res.json(factura);
    } catch (error) {
        return responderError(res, error, "No se pudo actualizar el estado de la factura");
    }
}

async function corregirPago(req, res) {
    try {
        if (req.contador) return res.status(403).json({ error: "Solo el titular puede corregir pagos" });
        const usuario = req.usuario.idUsuario;
        const idFactura = idValido(req.params.id);
        const { idPago: pagoSolicitado, motivo: texto, confirmar } = req.body || {};
        const idPago = idValido(pagoSolicitado, "Pago");
        const motivo = textoValido(texto, "El motivo", 500);
        if (confirmar !== true) throw new DatoFinancieroInvalido("Confirma expresamente la corrección del pago");

        const resultado = await enTransaccion(async conexion => {
            await bloquearPresupuestos(conexion, usuario);
            const actual = await cargarFactura(conexion, usuario, idFactura, true);
            if (!actual) return { estado: 404, error: "Factura no encontrada" };
            if (actual.estado !== "Pagada") return { estado: 409, error: "La factura no tiene un pago vigente que pueda corregirse" };
            const [[pago]] = await conexion.execute(
                `SELECT * FROM PagoFactura WHERE idPago = ? AND idFactura = ? AND idIngreso = ?
                 AND corregidoEn IS NULL FOR UPDATE`, [idPago, idFactura, actual.idIngreso]
            );
            if (!pago) return { estado: 409, error: "El pago solicitado ya cambió o carece de origen verificable" };

            const [[ingreso]] = await conexion.execute(
                `SELECT monto, fecha, idCategoria, idMetodoPago, estadoTransaccion FROM Ingreso
                 WHERE idIngreso = ? AND idUsuario = ? FOR UPDATE`, [pago.idIngreso, usuario]
            );
            if (!ingreso || ingreso.estadoTransaccion !== CONFIRMADA || ingreso.monto !== pago.monto ||
                actual.total !== pago.monto || actual.fechaPago !== pago.fechaPago || ingreso.fecha !== pago.fechaPago ||
                ingreso.idCategoria !== pago.idCategoria || ingreso.idMetodoPago !== pago.idMetodoPago) {
                return { estado: 409, error: "Los datos del ingreso no coinciden con el pago registrado" };
            }
            await conexion.execute(
                `UPDATE PagoFactura SET corregidoEn = NOW(), motivoCorreccion = ?, idActorCorreccion = ?
                 WHERE idPago = ? AND corregidoEn IS NULL`, [motivo, usuario, idPago]
            );
            await conexion.execute("UPDATE Factura SET estado = 'Pendiente', fechaPago = NULL, idIngreso = NULL WHERE idFactura = ?",
                [idFactura]);
            const anular = pago.origen === "Facturacion";
            if (anular) {
                await conexion.execute("UPDATE Ingreso SET estadoTransaccion = 'Anulada' WHERE idIngreso = ? AND idUsuario = ?",
                    [pago.idIngreso, usuario]);
            }
            await reevaluarMovimientos(conexion, usuario, [ingreso]);
            await registrarActividad(usuario,
                `Factura ${numeroFactura(actual.consecutivo)}: corrección del pago #${idPago}; ${anular ? "ingreso anulado" : "ingreso desvinculado"}`,
                "Facturación", req.ip, conexion);
            return { factura: await detalle(conexion, await cargarFactura(conexion, usuario, idFactura)) };
        });
        if (resultado.error) return res.status(resultado.estado).json({ error: resultado.error });
        return res.json(resultado.factura);
    } catch (error) {
        return responderError(res, error, "No se pudo corregir el pago");
    }
}

module.exports = { listar, obtener, guardar, cambiarEstado, ingresosElegibles, corregirPago };
