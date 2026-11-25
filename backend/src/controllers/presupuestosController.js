const pool = require("../config/db");
const { LIMITES_FREE, esPremium } = require("../utils/plan");
const { enTransaccion } = require("../utils/transaccion");
const { bloquearPresupuestos, consumeCupo, consultarPresupuestos, evaluar, reevaluarPresupuesto } =
    require("../utils/alertasPresupuesto");
const { DatoFinancieroInvalido, validarRango, montoValido, idValido, textoValido, estadoValido, responderError } =
    require("../utils/validacionFinanciera");
const ESTADOS = ["Activo", "Finalizado", "Cancelado"];

async function listar(req, res) {
    try {
        const idUsuario = req.usuario.idUsuario;
        const [presupuestos, premium] = await Promise.all([consultarPresupuestos(pool, idUsuario), esPremium(idUsuario)]);
        return res.json(presupuestos.map(({ total, hoy, ...p }) => ({ ...p, ...evaluar({ ...p, total, hoy }, premium).ejecucion })));
    } catch (error) {
        return responderError(res, error, "Error al obtener los presupuestos");
    }
}

async function guardar(req, res) {
    try {
        const body = req.body || {};
        const idUsuario = req.usuario.idUsuario;
        const id = req.params.id === undefined ? null : idValido(req.params.id);
        const nombre = textoValido(body.nombrePresupuesto, "El nombre", 100);
        const monto = montoValido(body.montoPresupuesto);
        const categoria = idValido(body.idCategoria, "Categoría");
        const { fechaInicio, fechaFin } = body;
        validarRango(fechaInicio, fechaFin);
        estadoValido(body.estado, ESTADOS);

        const guardado = await enTransaccion(async conexion => {
            await bloquearPresupuestos(conexion, idUsuario);
            let anterior;
            if (id) {
                [[anterior]] = await conexion.execute(
                    "SELECT idCategoria, estado, fechaFin FROM Presupuesto WHERE idPresupuesto = ? AND idUsuario = ? FOR UPDATE", [id, idUsuario]
                );
                if (!anterior) return null;
            }
            const estado = body.estado ?? anterior?.estado ?? "Activo";
            const [[{ hoy }]] = await conexion.execute("SELECT CURDATE() AS hoy");
            if (consumeCupo(estado, fechaFin, hoy) &&
                (!anterior || !consumeCupo(anterior.estado, anterior.fechaFin, hoy)) &&
                !(await esPremium(idUsuario, conexion))) {
                const [[{ activos }]] = await conexion.execute(
                    "SELECT COUNT(*) AS activos FROM Presupuesto WHERE idUsuario = ? AND estado = 'Activo' AND fechaFin >= ?",
                    [idUsuario, hoy]
                );
                if (activos >= LIMITES_FREE.presupuestosActivos) return false;
            }
            const [[cat]] = await conexion.execute("SELECT estado FROM CategoriaFinanciera WHERE idCategoria = ? LOCK IN SHARE MODE", [categoria]);
            if (!cat || (cat.estado !== "Activa" && anterior?.idCategoria !== categoria)) {
                throw new DatoFinancieroInvalido("Selecciona una categoría activa");
            }
            const valores = [nombre, monto, fechaInicio, fechaFin, categoria, estado];
            let idGuardado = id;
            if (id) {
                await conexion.execute(
                    `UPDATE Presupuesto SET nombrePresupuesto = ?, montoPresupuesto = ?, fechaInicio = ?, fechaFin = ?,
                     idCategoria = ?, estado = ? WHERE idPresupuesto = ? AND idUsuario = ?`, [...valores, id, idUsuario]
                );
            } else {
                const [resultado] = await conexion.execute(
                    `INSERT INTO Presupuesto (nombrePresupuesto, montoPresupuesto, fechaInicio, fechaFin, idCategoria, estado, idUsuario)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`, [...valores, idUsuario]
                );
                idGuardado = resultado.insertId;
            }
            await reevaluarPresupuesto(conexion, idUsuario, idGuardado);
            return idGuardado;
        });
        if (guardado === false) {
            return res.status(403).json({ error: `Free admite hasta ${LIMITES_FREE.presupuestosActivos} presupuestos activos. Libera un cupo para crear o activar otro presupuesto.` });
        }
        if (guardado === null) return res.status(404).json({ error: "No encontrado" });
        return id ? res.json({ mensaje: "Presupuesto actualizado" })
            : res.status(201).json({ mensaje: "Presupuesto creado", id: guardado });
    } catch (error) {
        return responderError(res, error, "Error al guardar el presupuesto");
    }
}

async function eliminar(req, res) {
    try {
        const id = idValido(req.params.id);
        const idUsuario = req.usuario.idUsuario;
        const [resultado] = await enTransaccion(async conexion => {
            await bloquearPresupuestos(conexion, idUsuario);
            return conexion.execute("DELETE FROM Presupuesto WHERE idPresupuesto = ? AND idUsuario = ?", [id, idUsuario]);
        });
        if (resultado.affectedRows === 0) return res.status(404).json({ error: "No encontrado" });
        return res.json({ mensaje: "Presupuesto eliminado" });
    } catch (error) {
        return responderError(res, error, "Error al eliminar el presupuesto");
    }
}

module.exports = { listar, crear: guardar, actualizar: guardar, eliminar };
