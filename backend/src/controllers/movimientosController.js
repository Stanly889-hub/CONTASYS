const pool = require("../config/db");
const { enTransaccion } = require("../utils/transaccion");
const { registrarActividad } = require("../utils/actividad");
const { CONFIRMADA, ESTADOS_MOVIMIENTO } = require("../utils/finanzas");
const { bloquearPresupuestos, reevaluarMovimientos } = require("../utils/alertasPresupuesto");
const { paginacion, respuestaPagina } = require("../utils/paginacion");
const { DatoFinancieroInvalido, validarRango, montoValido, fechaValida, idValido, textoValido, estadoValido, responderError } =
    require("../utils/validacionFinanciera");

// El nombre de tabla lo define la ruta, no la petición.
function crearControladorMovimientos(tabla) {
    const idColumna = `id${tabla}`;
    async function vinculado(conexion, id, usuario, eliminar = false) {
        if (tabla !== "Ingreso") return false;
        const [[factura]] = await conexion.execute(
            `SELECT idFactura FROM Factura WHERE idIngreso = ? AND idUsuario = ?
             UNION ALL
             SELECT idFactura FROM PagoFactura WHERE idIngreso = ?
               AND (? OR (origen = 'Facturacion' AND corregidoEn IS NOT NULL))
             LIMIT 1`, [id, usuario, id, eliminar]
        );
        return Boolean(factura);
    }

    async function listar(req, res) {
        try {
            const { fechaDesde, fechaHasta, idCategoria } = req.query;
            const pagina = paginacion(req.query);
            validarRango(fechaDesde, fechaHasta, false);
            const filtros = ["m.idUsuario = ?"];
            const params = [req.usuario.idUsuario];
            if (fechaDesde) { filtros.push("m.fecha >= ?"); params.push(fechaDesde); }
            if (fechaHasta) { filtros.push("m.fecha <= ?"); params.push(fechaHasta); }
            if (idCategoria !== undefined) {
                filtros.push("m.idCategoria = ?");
                params.push(idValido(idCategoria, "Categoría"));
            }
            const filtroBase = filtros.join(" AND ");
            const paramsBase = [...params];
            if (pagina?.fecha) {
                filtros.push(`(m.fecha < ? OR (m.fecha = ? AND m.${idColumna} < ?))`);
                params.push(pagina.fecha, pagina.fecha, pagina.id);
            }
            if (pagina) params.push(pagina.limite + 1);
            const registros = pool.execute(
                `SELECT m.${idColumna} AS id, m.monto, m.descripcion, m.numeroComprobante, m.fecha, m.estadoTransaccion,
                        c.idCategoria, c.nombreCategoria AS categoria, mp.idMetodoPago, mp.nombreMetodo AS metodoPago
                 FROM ${tabla} m
                 JOIN CategoriaFinanciera c ON m.idCategoria = c.idCategoria
                 JOIN MetodoPago mp ON m.idMetodoPago = mp.idMetodoPago
                 WHERE ${filtros.join(" AND ")} ORDER BY m.fecha DESC, m.${idColumna} DESC${pagina ? " LIMIT ?" : ""}`, params
            );
            if (!pagina) return res.json((await registros)[0]);
            const catalogos = req.query.catalogos === "1" && !pagina.fecha
                ? pool.execute(`SELECT c.idCategoria, c.nombreCategoria AS categoria FROM (
                    SELECT DISTINCT idCategoria FROM ${tabla} WHERE idUsuario = ?
                  ) m JOIN CategoriaFinanciera c ON c.idCategoria = m.idCategoria WHERE c.estado = 'Inactiva'`, [req.usuario.idUsuario])
                : Promise.resolve([[]]);
            const [[filas], [[totales]], [categoriasHistoricas]] = await Promise.all([registros, pool.execute(
                `SELECT COALESCE(SUM(CASE WHEN estadoTransaccion = 'Confirmada' THEN monto END), 0.00) AS confirmado,
                        COALESCE(SUM(CASE WHEN estadoTransaccion = 'Pendiente' THEN monto END), 0.00) AS pendiente
                 FROM ${tabla} m WHERE ${filtroBase}`, paramsBase
            ), catalogos]);
            return res.json({ ...respuestaPagina(filas, pagina, "fecha", "id"), totales,
                ...(req.query.catalogos === "1" ? { categoriasHistoricas } : {}) });
        } catch (error) {
            return responderError(res, error, "Error al obtener los movimientos");
        }
    }

    async function guardar(req, res) {
        try {
            const body = req.body || {};
            const idUsuario = req.usuario.idUsuario;
            const id = req.params.id === undefined ? null : idValido(req.params.id);
            const monto = montoValido(body.monto);
            const descripcion = textoValido(body.descripcion, "La descripción", 65535, false, texto => Buffer.byteLength(texto));
            const fecha = fechaValida(body.fecha);
            const categoria = idValido(body.idCategoria, "Categoría");
            const metodo = idValido(body.idMetodoPago, "Método de pago");

            const guardado = await enTransaccion(async conexion => {
                await bloquearPresupuestos(conexion, idUsuario);
                let anterior;
                if (id) {
                    [[anterior]] = await conexion.execute(
                        `SELECT idCategoria, idMetodoPago, estadoTransaccion, numeroComprobante, fecha FROM ${tabla}
                         WHERE ${idColumna} = ? AND idUsuario = ? FOR UPDATE`, [id, idUsuario]
                    );
                    if (!anterior) return null;
                    if (await vinculado(conexion, id, idUsuario)) return false;
                }

                const estado = estadoValido(body.estadoTransaccion, ESTADOS_MOVIMIENTO, anterior?.estadoTransaccion ?? CONFIRMADA);
                const comprobante = body.numeroComprobante === undefined
                    ? anterior?.numeroComprobante ?? null : textoValido(body.numeroComprobante, "El comprobante", 100, true);
                const [[cat]] = await conexion.execute(
                    "SELECT tipo, estado FROM CategoriaFinanciera WHERE idCategoria = ? LOCK IN SHARE MODE", [categoria]
                );
                if (!cat || cat.tipo !== tabla || (cat.estado !== "Activa" && anterior?.idCategoria !== categoria)) {
                    throw new DatoFinancieroInvalido("Selecciona una categoría activa y compatible con el movimiento");
                }
                const [[mp]] = await conexion.execute("SELECT estado FROM MetodoPago WHERE idMetodoPago = ? LOCK IN SHARE MODE", [metodo]);
                if (!mp || (mp.estado !== "Activo" && anterior?.idMetodoPago !== metodo)) {
                    throw new DatoFinancieroInvalido("Selecciona un método de pago activo");
                }

                const valores = [monto, descripcion, comprobante, fecha, categoria, metodo, estado];
                let idGuardado = id;
                if (id) {
                    await conexion.execute(
                        `UPDATE ${tabla} SET monto = ?, descripcion = ?, numeroComprobante = ?, fecha = ?,
                         idCategoria = ?, idMetodoPago = ?, estadoTransaccion = ?
                         WHERE ${idColumna} = ? AND idUsuario = ?`, [...valores, id, idUsuario]
                    );
                } else {
                    const [resultado] = await conexion.execute(
                        `INSERT INTO ${tabla} (monto, descripcion, numeroComprobante, fecha, idCategoria, idMetodoPago, estadoTransaccion, idUsuario)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [...valores, idUsuario]
                    );
                    idGuardado = resultado.insertId;
                }
                await reevaluarMovimientos(conexion, idUsuario, [anterior, { idCategoria: categoria, fecha, estadoTransaccion: estado }]);
                return idGuardado;
            });
            if (guardado === false) return res.status(409).json({ error: "El ingreso está protegido por el historial de facturación" });
            if (!guardado) return res.status(404).json({ error: "No encontrado" });
            await registrarActividad(idUsuario, id ? `Edición de ${tabla.toLowerCase()} #${id}` : `Registro de ${tabla.toLowerCase()} por ${monto}`, tabla, req.ip);
            return id ? res.json({ mensaje: "Actualizado correctamente" })
                : res.status(201).json({ mensaje: "Registrado correctamente", id: guardado });
        } catch (error) {
            return responderError(res, error, "Error al guardar el movimiento");
        }
    }

    async function eliminar(req, res) {
        try {
            const id = idValido(req.params.id);
            const idUsuario = req.usuario.idUsuario;
            const eliminado = await enTransaccion(async conexion => {
                await bloquearPresupuestos(conexion, idUsuario);
                const [[anterior]] = await conexion.execute(
                    `SELECT idCategoria, fecha, estadoTransaccion FROM ${tabla} WHERE ${idColumna} = ? AND idUsuario = ? FOR UPDATE`,
                    [id, idUsuario]
                );
                if (!anterior) return null;
                if (await vinculado(conexion, id, idUsuario, true)) return false;
                await conexion.execute(`DELETE FROM ${tabla} WHERE ${idColumna} = ? AND idUsuario = ?`, [id, idUsuario]);
                await reevaluarMovimientos(conexion, idUsuario, [anterior]);
                return true;
            });
            if (eliminado === false) return res.status(409).json({ error: "El ingreso está protegido por el historial de facturación" });
            if (!eliminado) return res.status(404).json({ error: "No encontrado" });
            await registrarActividad(req.usuario.idUsuario, `Eliminación de ${tabla.toLowerCase()} #${id}`, tabla, req.ip);
            return res.json({ mensaje: "Eliminado correctamente" });
        } catch (error) {
            return responderError(res, error, "Error al eliminar el movimiento");
        }
    }

    return { listar, crear: guardar, actualizar: guardar, eliminar };
}

module.exports = { crearControladorMovimientos };
